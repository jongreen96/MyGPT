import { ModelListType, models } from '@/lib/ai-models';
import { auth } from '@/lib/auth';
import { chargeUser, createConversation, saveMessages } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createDataStreamResponse, Message, streamText } from 'ai';

export const maxDuration = 600;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

// TODO: URGENT! Add logic to prevent users going negative with credits

export async function POST(req: Request) {
  const session = await auth();
  if (typeof session?.user?.id === 'undefined') return;

  // eslint-disable-next-line prefer-const
  let { messages, conversationId, model } = (await req.json()) as {
    messages: Message[];
    conversationId: string;
    model: ModelListType;
  };

  if (session.user.credits <= 0)
    return Response.json({ error: 'Insufficient credits' }, { status: 402 });

  if (!conversationId)
    conversationId = await createConversation({
      userId: session?.user?.id,
      messages,
      model,
    });

  await processAttachments(messages, session.user.id);

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: openai(model) || openai('gpt-4o-mini'),
        system:
          'When returning code ALWAYS use markdown and use the CORRECT FULL language name',
        messages,

        onFinish({ text, usage }) {
          dataStream.writeMessageAnnotation({
            conversationId,
          });

          saveMessages({
            conversationId,
            userMessage: messages[messages.length - 1],
            assistantMessage: { content: text },
            usage,
          });

          chargeUser({
            userId: session.user.id!,
            cost:
              (models[model].inputCost / 1_000_000) * usage.promptTokens +
              (models[model].outputCost / 1_000_000) * usage.completionTokens,
          });
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error) => {
      return error instanceof Error ? error.message : String(error);
    },
  });
}

async function processAttachments(messages: Message[], userId: string) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.experimental_attachments) return;

  for (const attachment of lastMessage.experimental_attachments) {
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
      Key: `user-images/${userId}/${attachment.name}`,
      ContentType: attachment.contentType,
      Body: Buffer.from(attachment.url.split(',')[1], 'base64'),
    });

    await client.send(command);

    attachment.url = `${process.env.CLOUDFLARE_URL!}/user-images/${userId}/${attachment.name}`;
  }
}
