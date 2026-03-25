import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  AlertCircle,
  RefreshCw,
  TrendingUp,
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
  Badge,
  Spinner,
  EmptyState,
  Input,
  Modal,
} from '@/components/ui'

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  top_up: 'Top Up',
  payment_hold: 'Payment (Escrow)',
  payment_release: 'Payment Received',
  payment_refund: 'Refund',
  withdrawal: 'Withdrawal',
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]

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

export function WalletPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [topUpModal, setTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [topUpError, setTopUpError] = useState<string | null>(null)
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null)

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

  const handleTopUp = async () => {
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

    setTopUpLoading(true)
    setTopUpError(null)
    setTopUpSuccess(null)
    try {
      const { error } = await supabase.rpc('top_up_wallet', { p_amount: amount })
      if (error) throw error
      setTopUpSuccess(`${formatCurrency(amount)} added to your wallet!`)
      setTopUpAmount('')
      await fetchWallet()
      setTimeout(() => {
        setTopUpModal(false)
        setTopUpSuccess(null)
      }, 1500)
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : 'Top-up failed')
    } finally {
      setTopUpLoading(false)
    }
  }

  const creditTotal = transactions
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amount, 0)

  const debitTotal = transactions
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to={ROUTES.LOGIN} replace />

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
                  <p className="text-sm font-medium text-primary-200">Available Balance</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight">
                    {APP_CURRENCY_SYMBOL}{(wallet?.balance ?? 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm text-primary-200">{profile.full_name}</p>
                </div>
                <span className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <WalletIcon className="size-6 text-white" />
                </span>
              </div>
              <div className="mt-6">
                <Button
                  variant="white"
                  onClick={() => {
                    setTopUpAmount('')
                    setTopUpError(null)
                    setTopUpSuccess(null)
                    setTopUpModal(true)
                  }}
                  icon={<Plus className="size-4" />}
                >
                  Add Money
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
                <Button size="sm" variant="ghost" onClick={fetchWallet} icon={<RefreshCw className="size-4" />}>
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
              <li>Add money to your wallet using the "Add Money" button.</li>
              <li>When you pay for a booking, the amount is <strong>held in escrow</strong> — it's deducted from your balance but not yet sent to the provider.</li>
              <li>Once both you and the provider confirm satisfaction, the funds are <strong>automatically released</strong> to the provider.</li>
              <li>If there's a dispute, an admin can review and either <strong>refund</strong> you or <strong>release</strong> funds to the provider.</li>
            </ul>
          </div>
        </>
      )}

      {/* Top-up Modal */}
      <Modal
        isOpen={topUpModal}
        onClose={() => setTopUpModal(false)}
        title="Add Money to Wallet"
        size="sm"
      >
        <div className="space-y-4">
          {topUpSuccess ? (
            <div className="rounded-lg bg-success-50 p-4 text-center text-success-700 font-medium">
              {topUpSuccess}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Select a preset amount or enter a custom amount (min P10, max P10,000).
              </p>

              {topUpError && (
                <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                  {topUpError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(String(amt))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      topUpAmount === String(amt)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                  >
                    {APP_CURRENCY_SYMBOL}{amt}
                  </button>
                ))}
              </div>

              <Input
                label="Amount (BWP)"
                type="number"
                min={10}
                max={10000}
                step={1}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTopUpModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleTopUp}
                  loading={topUpLoading}
                  disabled={!topUpAmount || topUpLoading}
                >
                  Add {topUpAmount ? formatCurrency(parseFloat(topUpAmount) || 0) : 'Money'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
