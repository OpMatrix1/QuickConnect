import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Minus,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Smartphone,
  Building2,
  ChevronLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES, APP_CURRENCY_SYMBOL } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { Wallet, WalletTransaction } from '@/lib/types'
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Spinner,
  EmptyState,
  Input,
  Modal,
} from '@/components/ui'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  top_up: 'Top Up',
  payment_hold: 'Payment (Escrow)',
  payment_release: 'Payment Received',
  payment_refund: 'Refund',
  withdrawal: 'Withdrawal',
  dispute_adjustment: 'Dispute adjustment',
  shadow_reserve: 'Reserved for job',
  shadow_release: 'Reservation released',
  consultation_fee: 'Consultation Fee',
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]
const WITHDRAW_PRESETS = [50, 100, 200, 500]

interface Provider {
  id: string
  label: string
  color: string
  bg: string
  border: string
  placeholder: string
  inputLabel: string
  type: 'mobile' | 'bank'
}

const PROVIDERS: Provider[] = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    placeholder: '77x xxx xxx',
    inputLabel: 'Orange Money Number',
    type: 'mobile',
  },
  {
    id: 'btc_myzaka',
    label: 'BTC Smega',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-400',
    placeholder: '71x xxx xxx',
    inputLabel: 'Smega Number (BTC)',
    type: 'mobile',
  },
  {
    id: 'mascom_myzaka',
    label: 'Mascom MyZaka',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    placeholder: '74x xxx xxx',
    inputLabel: 'MyZaka Number (Mascom)',
    type: 'mobile',
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    placeholder: 'Account number',
    inputLabel: 'Bank Account Number',
    type: 'bank',
  },
]

// ---------------------------------------------------------------------------
// TransactionRow
// ---------------------------------------------------------------------------

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.direction === 'credit'
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-9 items-center justify-center rounded-full ${
            isCredit ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
          }`}
        >
          {isCredit ? (
            <ArrowDownLeft className="size-4" />
          ) : (
            <ArrowUpRight className="size-4" />
          )}
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
          </p>
          {tx.description && (
            <p className="text-xs text-gray-500">{tx.description}</p>
          )}
          <p className="text-xs text-gray-400">
            {new Date(tx.created_at).toLocaleDateString('en-BW', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isCredit ? 'text-success-600' : 'text-danger-600'
        }`}
      >
        {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simulated processing screen (shared by top-up and withdrawal)
// ---------------------------------------------------------------------------

function ProcessingScreen({
  message,
  subMessage,
}: {
  message: string
  subMessage?: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Loader2 className="size-10 animate-spin text-primary-500" />
      <div>
        <p className="font-semibold text-gray-900">{message}</p>
        {subMessage && <p className="mt-1 text-sm text-gray-500">{subMessage}</p>}
      </div>
    </div>
  )
}

function SuccessScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle2 className="size-10 text-success-500" />
      <p className="font-semibold text-success-700">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main WalletPage
// ---------------------------------------------------------------------------

export function WalletPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // — Top-up state —
  const [topUpModal, setTopUpModal] = useState(false)
  const [topUpStep, setTopUpStep] = useState<'enter' | 'processing' | 'success'>('enter')
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpError, setTopUpError] = useState<string | null>(null)

  // — Withdraw state —
  const [withdrawModal, setWithdrawModal] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<'enter' | 'processing' | 'success'>('enter')
  const [withdrawDestination, setWithdrawDestination] = useState('')
  const [withdrawBankName, setWithdrawBankName] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------

  const fetchWallet = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (walletErr) throw walletErr
      setWallet(walletData as Wallet)

      const { data: txData, error: txErr } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', (walletData as Wallet).id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (txErr) throw txErr
      setTransactions((txData ?? []) as WalletTransaction[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  // Live balance updates — subscribe to wallet row changes
  useEffect(() => {
    if (!user?.id) return

    const ch = supabase
      .channel(`wallet-balance:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        () => { void fetchWallet() }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user?.id, fetchWallet])

  // Live transaction list — subscribe to wallet_transactions for this wallet
  useEffect(() => {
    if (!wallet?.id) return

    const ch = supabase
      .channel(`wallet-transactions:${wallet.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `wallet_id=eq.${wallet.id}`,
        },
        () => { void fetchWallet() }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [wallet?.id, fetchWallet])

  // ---------------------------------------------------------------------------
  // Top-up handlers
  // ---------------------------------------------------------------------------

  function openTopUp() {
    setTopUpStep('enter')
    setTopUpAmount('')
    setTopUpError(null)
    setTopUpModal(true)
  }

  async function handleTopUpConfirm() {
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) {
      setTopUpError('Please enter a valid amount')
      return
    }
    if (amount < 10) {
      setTopUpError('Minimum top-up amount is P10')
      return
    }
    if (amount > 10000) {
      setTopUpError('Maximum top-up amount is P10,000 per transaction')
      return
    }

    setTopUpError(null)
    setTopUpStep('processing')

    try {
      const { error } = await supabase.rpc('top_up_wallet', { p_amount: amount } as never)
      if (error) throw error
      setTopUpStep('success')
      await fetchWallet()
      setTimeout(() => setTopUpModal(false), 1800)
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : (err as any)?.message ?? 'Top-up failed')
      setTopUpStep('enter')
    }
  }

  // ---------------------------------------------------------------------------
  // Withdraw handlers
  // ---------------------------------------------------------------------------

  function openWithdraw() {
    setWithdrawStep('enter')
    setWithdrawDestination('')
    setWithdrawBankName('')
    setWithdrawAmount('')
    setWithdrawError(null)
    setWithdrawModal(true)
  }

  async function handleWithdrawConfirm() {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      setWithdrawError('Please enter a valid amount')
      return
    }
    if (amount < 20) {
      setWithdrawError('Minimum withdrawal amount is P20')
      return
    }
    if (amount > 5000) {
      setWithdrawError('Maximum withdrawal amount is P5,000 per transaction')
      return
    }

    setWithdrawError(null)
    setWithdrawStep('processing')

    try {
      const { error } = await supabase.rpc('withdraw_from_wallet', {
        p_amount: amount,
        p_method: 'orange_money',
        p_destination: 'demo',
      } as never)
      if (error) throw error
      setWithdrawStep('success')
      await fetchWallet()
      setTimeout(() => setWithdrawModal(false), 1800)
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : (err as any)?.message ?? 'Withdrawal failed')
      setWithdrawStep('enter')
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const creditTotal = transactions
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amount, 0)

  const debitTotal = transactions
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to={ROUTES.LOGIN} replace />

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Wallet</h1>
        <p className="mt-1 text-gray-600">Manage your QuickConnect balance</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button size="sm" variant="ghost" onClick={fetchWallet} className="ml-auto">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Balance card */}
          <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
            <CardContent className="py-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-primary-200">Withdrawable balance</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight">
                    {APP_CURRENCY_SYMBOL}
                    {(
                      (wallet?.balance ?? 0) -
                      (wallet?.reserved_balance ?? 0)
                    ).toFixed(2)}
                  </p>
                  <p className="mt-2 text-sm text-primary-200/90">
                    Total {APP_CURRENCY_SYMBOL}{(wallet?.balance ?? 0).toFixed(2)}
                    {(wallet?.reserved_balance ?? 0) > 0 && (
                      <>
                        {' '}
                        · Reserved for accepted jobs{' '}
                        {APP_CURRENCY_SYMBOL}{(wallet?.reserved_balance ?? 0).toFixed(2)}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-primary-200">{profile.full_name}</p>
                </div>
                <span className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <WalletIcon className="size-6 text-white" />
                </span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="white"
                  onClick={openTopUp}
                  icon={<Plus className="size-4" />}
                >
                  Add Money
                </Button>
                <Button
                  variant="outline"
                  onClick={openWithdraw}
                  icon={<Minus className="size-4" />}
                  className="border-white/40 text-white hover:bg-white/10 hover:border-white/60"
                >
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-success-50">
                  <ArrowDownLeft className="size-5 text-success-600" />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Total Received</p>
                  <p className="text-lg font-semibold text-success-600">
                    +{formatCurrency(creditTotal)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-danger-50">
                  <ArrowUpRight className="size-5 text-danger-600" />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Total Spent</p>
                  <p className="text-lg font-semibold text-danger-600">
                    -{formatCurrency(debitTotal)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction history */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchWallet}
                  icon={<RefreshCw className="size-4" />}
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="size-10 text-gray-400" />}
                  title="No transactions yet"
                  description="Your wallet history will appear here after your first top-up or payment."
                />
              ) : (
                <div>
                  {transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">How the wallet works</p>
            <ul className="space-y-1 list-disc list-inside text-blue-600">
              <li>Add money to your wallet to pay for bookings.</li>
              <li>
                When you pay for a booking, the amount is{' '}
                <strong>held in escrow</strong> — not yet sent to the provider.
              </li>
              <li>
                Once both parties confirm satisfaction, funds are{' '}
                <strong>automatically released</strong> to the provider.
              </li>
              <li>Withdraw your available balance at any time.</li>
            </ul>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* Top-Up Modal                                                        */}
      {/* ================================================================= */}
      <Modal
        isOpen={topUpModal}
        onClose={() => topUpStep !== 'processing' && setTopUpModal(false)}
        title={topUpStep === 'processing' ? 'Processing…' : topUpStep === 'success' ? 'Top-Up Complete' : 'Add Money'}
        size="sm"
      >
        {topUpStep === 'enter' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700">
              Demo mode — funds are added directly to your wallet.
            </div>

            {topUpError && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                {topUpError}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Amount (BWP)</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(String(amt))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      topUpAmount === String(amt)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:border-primary-300'
                    }`}
                  >
                    {APP_CURRENCY_SYMBOL}{amt}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={10}
                max={10000}
                step={1}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount (min P10)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setTopUpModal(false)}>Cancel</Button>
              <Button onClick={handleTopUpConfirm} disabled={!topUpAmount}>
                Add {topUpAmount ? formatCurrency(parseFloat(topUpAmount) || 0) : 'Money'}
              </Button>
            </div>
          </div>
        )}

        {topUpStep === 'processing' && (
          <ProcessingScreen message="Adding funds…" subMessage="Please wait a moment." />
        )}
        {topUpStep === 'success' && (
          <SuccessScreen message={`${formatCurrency(parseFloat(topUpAmount))} added to your wallet!`} />
        )}
      </Modal>

      {/* ================================================================= */}
      {/* Withdraw Modal                                                      */}
      {/* ================================================================= */}
      <Modal
        isOpen={withdrawModal}
        onClose={() => withdrawStep !== 'processing' && setWithdrawModal(false)}
        title={withdrawStep === 'processing' ? 'Processing…' : withdrawStep === 'success' ? 'Withdrawal Submitted' : 'Withdraw Funds'}
        size="sm"
      >
        {withdrawStep === 'enter' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700">
              Demo mode — funds are deducted directly from your wallet.
            </div>

            <p className="text-sm text-gray-600">
              Available balance:{' '}
              <strong>{APP_CURRENCY_SYMBOL}{((wallet?.balance ?? 0) - (wallet?.reserved_balance ?? 0)).toFixed(2)}</strong>
            </p>

            {withdrawError && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                {withdrawError}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Amount (BWP)</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {WITHDRAW_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWithdrawAmount(String(amt))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      withdrawAmount === String(amt)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:border-primary-300'
                    }`}
                  >
                    {APP_CURRENCY_SYMBOL}{amt}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={20}
                max={5000}
                step={1}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount (min P20)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setWithdrawModal(false)}>Cancel</Button>
              <Button onClick={handleWithdrawConfirm} disabled={!withdrawAmount}>
                Withdraw {withdrawAmount ? formatCurrency(parseFloat(withdrawAmount) || 0) : ''}
              </Button>
            </div>
          </div>
        )}

        {withdrawStep === 'processing' && (
          <ProcessingScreen message="Processing withdrawal…" subMessage="Please wait a moment." />
        )}
        {withdrawStep === 'success' && (
          <SuccessScreen message={`${formatCurrency(parseFloat(withdrawAmount))} withdrawal submitted!`} />
        )}
      </Modal>
    </div>
  )
}
