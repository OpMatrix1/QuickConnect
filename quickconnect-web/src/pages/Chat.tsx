import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MessageCircle,
  Send,
  ChevronLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/constants'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { Profile, Message } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import {
  Button,
  Avatar,
  Spinner,
  EmptyState,
  Input,
} from '@/components/ui'

interface ConversationWithProfiles {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string | null
  participant_1_profile: Profile
  participant_2_profile: Profile
  last_message?: Message
}

export function Chat() {
  const { id: conversationId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [conversations, setConversations] = useState<ConversationWithProfiles[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  useEffect(() => {
    if (conversationId) setMobileShowChat(true)
  }, [conversationId])

  activeConversationIdRef.current = conversationId

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchConversations = useCallback(async () => {
    if (!user) return
    setConversationsLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          participant_1_profile:profiles!participant_1(id, full_name, avatar_url),
          participant_2_profile:profiles!participant_2(id, full_name, avatar_url)
        `
        )
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (fetchError) throw fetchError

      const convos = (data ?? []) as ConversationWithProfiles[]

      const withLastMessage = await Promise.all(
        convos.map(async (c) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          return { ...c, last_message: lastMsg ?? undefined }
        })
      )

      setConversations(withLastMessage as ConversationWithProfiles[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
      setConversations([])
    } finally {
      setConversationsLoading(false)
    }
  }, [user])

  const refreshUnread = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('receiver_id', user.id)
      .eq('is_read', false)
    const counts: Record<string, number> = {}
    ;(data ?? []).forEach((m: { conversation_id: string }) => {
      counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1
    })
    setUnreadByConv(counts)
  }, [user])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setMessagesLoading(false)
      return
    }
    setMessagesLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError
      setMessages((data ?? []) as Message[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    void refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`messages-inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as Message
          const activeId = activeConversationIdRef.current
          if (activeId && row.conversation_id === activeId) {
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row]
            )
          }
          await fetchConversations()
          await refreshUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchConversations, refreshUnread])

  useEffect(() => {
    if (!conversationId || !user) return

    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .then(() => {
        void fetchConversations()
        void refreshUnread()
      })
  }, [conversationId, user, fetchConversations, refreshUnread])

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return

    const conv = conversations.find((c) => c.id === conversationId)
    if (!conv) return

    const receiverId =
      conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1

    setSending(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: newMessage.trim(),
          is_read: false,
        })
        .select()
        .single()

      if (error) throw error

      setMessages((prev) => [...prev, (data as Message)])
      setNewMessage('')

      fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const getOtherParticipant = (convId: string): Profile | null => {
    const conv = conversations.find((c) => c.id === convId)
    if (!conv || !user) return null
    return conv.participant_1 === user.id
      ? conv.participant_2_profile
      : conv.participant_1_profile
  }

  const getUnreadCount = (convId: string): number => unreadByConv[convId] ?? 0

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    navigate(ROUTES.LOGIN, { replace: true })
    return null
  }

  const otherParticipant = conversationId
    ? getOtherParticipant(conversationId)
    : null

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-1 min-h-0">
        <div
          className={cn(
            'flex w-full flex-col border-r border-gray-200 bg-gray-50/50 lg:w-80 lg:flex-shrink-0',
            mobileShowChat && 'hidden lg:flex'
          )}
        >
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Spinner />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<MessageCircle className="size-12 text-gray-400" />}
                  title="No conversations yet"
                  description="Start a conversation by contacting a provider from their profile."
                  action={
                    <Link to={ROUTES.PROVIDERS}>
                      <Button variant="outline">Browse providers</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map((conv) => {
                  const other = getOtherParticipant(conv.id)
                  const isActive = conv.id === conversationId
                  const unread = getUnreadCount(conv.id)

                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        navigate(ROUTES.CHAT_CONVERSATION.replace(':id', conv.id))
                        setMobileShowChat(true)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-100',
                        isActive && 'bg-primary-50'
                      )}
                    >
                      <Avatar
                        src={other?.avatar_url}
                        fallback={other?.full_name ?? '?'}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-gray-900">
                            {other?.full_name ?? 'Unknown'}
                          </span>
                          {conv.last_message_at && (
                            <span className="shrink-0 text-xs text-gray-500">
                              {formatRelativeTime(conv.last_message_at)}
                            </span>
                          )}
                        </div>
                        {conv.last_message && (
                          <p className="truncate text-sm text-gray-500">
                            {conv.last_message.sender_id === user.id
                              ? 'You: '
                              : ''}
                            {conv.last_message.content}
                          </p>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-medium text-white">
                          {unread}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'flex flex-1 flex-col bg-white',
            !mobileShowChat && conversationId && 'hidden lg:flex',
            !conversationId && 'hidden lg:flex'
          )}
        >
          {!conversationId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="size-16 text-gray-300" />
              <p className="mt-4 text-gray-600">
                Select a conversation or start a new one
              </p>
              <Link to={ROUTES.PROVIDERS} className="mt-4">
                <Button variant="outline">Find providers</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  icon={<ChevronLeft className="size-5" />}
                  onClick={() => {
                    setMobileShowChat(false)
                    navigate(ROUTES.CHAT)
                  }}
                />
                <Avatar
                  src={otherParticipant?.avatar_url}
                  fallback={otherParticipant?.full_name ?? '?'}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {otherParticipant?.full_name ?? 'Unknown'}
                  </h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === user.id
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2',
                            isOwn
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-200 text-gray-900'
                          )}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p
                            className={cn(
                              'mt-1 text-xs',
                              isOwn ? 'text-primary-100' : 'text-gray-500'
                            )}
                          >
                            {formatRelativeTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    icon={<Send className="size-4" />}
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    loading={sending}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
