import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { deleteConversation, getConversations } from '@/lib/db';
import getSession from '@/lib/hooks/get-session';
import {
  MessageSquare,
  MoreHorizontalIcon,
  PlusIcon,
  SquarePen,
  X,
} from 'lucide-react';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Button, buttonVariants } from './ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Separator } from './ui/separator';
import { CustomInternalTrigger } from './ui/sidebar-trigger';
import { Table, TableBody, TableCell, TableRow } from './ui/table';
import UserAvatar from './ui/user-avatar';

export async function AppSidebar() {
  const session = await getSession();
  const conversations = session?.user?.id
    ? await getConversations(session.user.id)
    : [];

  return (
    <Sidebar variant='floating' className='h-dvh'>
      <SidebarHeader>
        <div className='flex items-center justify-between'>
          <CustomInternalTrigger />
          <Button asChild variant='ghost' size='icon'>
            <Link href='/chat'>
              <SquarePen className='scale-125' />
            </Link>
          </Button>
        </div>
        <Separator />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton asChild>
                    <Link href={`/chat/${conversation.id}`}>
                      <MessageSquare />
                      <span>{conversation.subject}</span>
                    </Link>
                  </SidebarMenuButton>

                  <ConversationDropdownMenu conversation={conversation} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='-mb-2'>
        <Link href='/chat/pricing' className={buttonVariants()}>
          <PlusIcon />
          Add Credits
        </Link>

        <Separator />

        <div>
          <UserAvatar
            userName={session.user?.name}
            userImage={session.user?.image}
            userEmail={session.user.email}
            userCredits={session.user.credits}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ConversationDropdownMenu({
  conversation,
}: {
  conversation: {
    id: string;
    subject: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number };
  };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction>
          <MoreHorizontalIcon />
        </SidebarMenuAction>
      </DropdownMenuTrigger>

      <DropdownMenuContent className='w-min'>
        <ConversationInformation conversation={conversation} />

        <ConversationDelete id={conversation.id} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConversationInformation({
  conversation,
}: {
  conversation: {
    id: string;
    subject: string;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}) {
  return (
    <DropdownMenuItem asChild>
      <Dialog>
        <DialogTrigger className='w-full rounded p-1 text-left text-sm'>
          Information
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center justify-between'>
              Conversation Information
              <DialogClose asChild>
                <Button variant='outline' size='icon'>
                  <X />
                </Button>
              </DialogClose>
            </DialogTitle>
            <DialogDescription>
              Information about model settings as well as usage
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Model</TableCell>
                <TableCell>{conversation.model}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Input Tokens</TableCell>
                <TableCell>{conversation.usage.inputTokens}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Output Tokens</TableCell>
                <TableCell>{conversation.usage.outputTokens}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </DropdownMenuItem>
  );
}

function ConversationDelete({ id }: { id: string }) {
  return (
    <DropdownMenuItem asChild>
      <AlertDialog>
        <AlertDialogTrigger className='w-full rounded bg-destructive/50 p-1 text-left text-sm'>
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <form
              action={async () => {
                'use server';
                await deleteConversation(id);
                revalidatePath('/chat');
              }}
            >
              <AlertDialogAction asChild>
                <button type='submit' className='w-full'>
                  Delete
                </button>
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenuItem>
  );
}
