import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MessageCircle,
  Send,
  ChevronLeft,
  Paperclip,
  HardHat,
  MapPin,
  ImageIcon,
  FileText,
  Smile,
  X,
  Download,
} from 'lucide-react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
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
  Modal,
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
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)

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

  const getReceiverId = useCallback(() => {
    if (!conversationId || !user) return null
    const conv = conversations.find((c) => c.id === conversationId)
    if (!conv) return null
    return conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
  }, [conversationId, user, conversations])

  // Close attach menu when clicking outside
  useEffect(() => {
    if (!attachMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [attachMenuOpen])

  const uploadMedia = async (file: File, type: 'image' | 'file'): Promise<{ url: string; name: string } | null> => {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${user!.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-media').upload(path, file)
    if (error) { setError('Upload failed: ' + error.message); return null }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path)
    return { url: urlData.publicUrl, name: file.name }
  }

  const sendMediaMessage = async (file: File, type: 'image' | 'file') => {
    if (!conversationId || !user) return
    const receiverId = getReceiverId()
    if (!receiverId) return
    setUploadingMedia(true)
    try {
      const result = await uploadMedia(file, type)
      if (!result) return
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: type === 'image' ? '📷 Image' : `📎 ${result.name}`,
          is_read: false,
          message_type: type,
          media_url: result.url,
          media_name: result.name,
        })
        .select()
        .single()
      if (error) throw error
      setMessages((prev) => [...prev, data as Message])
      fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send media')
    } finally {
      setUploadingMedia(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return

    const receiverId = getReceiverId()
    if (!receiverId) return

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
          message_type: 'text',
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
    <>
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
                    const type = msg.message_type ?? 'text'
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
                            'max-w-[75%] rounded-2xl overflow-hidden',
                            type === 'image' ? '' : 'px-4 py-2',
                            isOwn
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-200 text-gray-900'
                          )}
                        >
                          {type === 'image' && msg.media_url ? (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.media_url}
                                alt={msg.media_name ?? 'Image'}
                                className="max-w-full max-h-64 object-cover"
                              />
                            </a>
                          ) : type === 'file' && msg.media_url ? (
                            <div className="flex items-center gap-2 px-4 py-2">
                              <FileText className="size-5 shrink-0" />
                              <span className="truncate text-sm flex-1">{msg.media_name ?? 'File'}</span>
                              <a
                                href={msg.media_url}
                                download={msg.media_name ?? true}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="size-4 shrink-0 opacity-70 hover:opacity-100" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                          <p
                            className={cn(
                              'text-xs px-4 pb-2',
                              type === 'image' ? 'pt-1' : 'mt-1 px-0 pb-0',
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

              <div className="border-t border-gray-200 p-3">
                {/* Emoji picker */}
                {emojiPickerOpen && (
                  <div className="absolute bottom-[5.5rem] left-4 z-50 shadow-xl rounded-xl overflow-hidden">
                    <EmojiPicker
                      theme={Theme.LIGHT}
                      onEmojiClick={(data: EmojiClickData) => {
                        setNewMessage((prev) => prev + data.emoji)
                        setEmojiPickerOpen(false)
                      }}
                      height={350}
                      width={300}
                    />
                  </div>
                )}

                {/* Hidden file inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await sendMediaMessage(file, 'image')
                    e.target.value = ''
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await sendMediaMessage(file, 'file')
                    e.target.value = ''
                  }}
                />

                <div className="flex items-center gap-2">
                  {/* Attachment menu */}
                  <div className="relative" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => { setAttachMenuOpen((p) => !p); setEmojiPickerOpen(false) }}
                      title="Attachments"
                      className={cn(
                        'flex shrink-0 items-center justify-center rounded-xl border p-2.5 transition-colors',
                        attachMenuOpen
                          ? 'border-primary-400 bg-primary-50 text-primary-600'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {attachMenuOpen ? <X className="size-5" /> : <Paperclip className="size-5" />}
                    </button>

                    {attachMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl min-w-[160px] z-50">
                        <button
                          type="button"
                          onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click() }}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          <ImageIcon className="size-4 text-green-500" />
                          Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click() }}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          <FileText className="size-4 text-blue-500" />
                          File
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAttachMenuOpen(false); setEmojiPickerOpen(true) }}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          <Smile className="size-4 text-yellow-500" />
                          Emoji
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAttachMenuOpen(false); setLocationModalOpen(true) }}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          <MapPin className="size-4 text-red-500" />
                          Location
                        </button>
                      </div>
                    )}
                  </div>

                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void sendMessage()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    icon={<Send className="size-4" />}
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || uploadingMedia}
                    loading={sending || uploadingMedia}
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

    {/* Location sharing — under construction */}
    <Modal
      isOpen={locationModalOpen}
      onClose={() => setLocationModalOpen(false)}
      title=""
    >
      <div className="flex flex-col items-center gap-4 px-2 py-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-warning-100">
          <HardHat className="size-10 text-warning-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Under Construction</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Location sharing is coming soon. Once the maps integration is set
            up, you'll be able to pin and share exact meeting spots directly in
            the chat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLocationModalOpen(false)}
          className="mt-1 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Got it
        </button>
      </div>
    </Modal>
    </>
  )
}
