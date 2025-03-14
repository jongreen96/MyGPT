import { ModelListType, models } from '@/lib/ai-models';
import { auth } from '@/lib/auth';
import { chargeUser, createConversation, saveMessages } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { experimental_generateImage as generateImage, Message } from 'ai';
import { nanoid } from 'nanoid';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export async function POST(req: Request) {
  const session = await auth();
  if (typeof session?.user?.id === 'undefined') return;

  // eslint-disable-next-line prefer-const
  let { prompt, conversationId, model } = (await req.json()) as {
    prompt: Message;
    conversationId?: string;
    model: ModelListType;
  };

  if (session.user.credits < models[model].outputCost * 1.5 * 100_000)
    return Response.json({ error: 'Insufficient credits' }, { status: 402 });

  if (!conversationId)
    conversationId = await createConversation({
      userId: session?.user?.id,
      messages: [prompt],
      model,
    });

  const { image } = await generateImage({
    model: openai.image(model),
    prompt: prompt.content,
    size: '1024x1024',
    providerOptions: { openai: { style: 'vivid', quality: 'hd' } },
  });

  const Key = `ai-images/${session.user.id}/${nanoid()}`;
  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
    Key,
    ContentType: 'image/png',
    Body: Buffer.from(image.base64, 'base64'),
  });

  await client.send(command);

  await chargeUser({ userId: session.user.id, cost: models[model].outputCost });

  const responseMessage = {
    content: undefined,
    experimental_attachments: [
      {
        name: Key.split('/').pop(),
        contentType: 'image/png',
        url: `${process.env.CLOUDFLARE_URL!}/${Key}`,
      },
    ],
  };

  saveMessages({
    conversationId,
    userMessage: prompt,
    assistantMessage: responseMessage,
    usage: { promptTokens: 0, completionTokens: 1000, totalTokens: 1000 },
  });

  return Response.json({ conversationId, message: responseMessage });
}
