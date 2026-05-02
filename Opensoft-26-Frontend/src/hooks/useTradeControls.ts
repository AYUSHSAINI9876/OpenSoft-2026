import { useEffect, useMemo, useState } from 'react'
import type { TradeAction, TradeRequest } from '../types/market'

type Direction = 'long' | 'short'

export type TradeIntent = {
  direction: Direction
  quantity: number
  limitPrice: number
  orderType: 'limit' | 'market'
  sideLabel: string
  canSubmit: boolean
}

export const useTradeControls = (marketPrice: number, asset: string, onExecute: (request: TradeRequest) => void) => {
  const [direction, setDirection] = useState<Direction>('long')
  const [orderType, setOrderType] = useState<'limit' | 'market'>('market')
  const [quantityText, setQuantityText] = useState('0')
  const [priceText, setPriceText] = useState(() => marketPrice ? marketPrice.toFixed(2) : '0.00')
  const [stopLossText, setStopLossText] = useState('')
  const [targetText, setTargetText] = useState('')

  useEffect(() => {
    if (marketPrice) {
      setPriceText(marketPrice.toFixed(2))
    }
  }, [asset])

  const effectivePriceText = orderType === 'market' && marketPrice ? marketPrice.toFixed(2) : priceText

  const quantity = Number(quantityText)
  const limitPrice = Number(effectivePriceText)
  const stopLoss = stopLossText ? Number(stopLossText) : undefined
  const takeProfit = targetText ? Number(targetText) : undefined

  const sideLabel = `${orderType.toUpperCase()} · ${direction === 'long' ? 'Buy to Open / Sell to Close' : 'Sell to Open / Buy to Close'}`
  const canSubmit =
    Number.isFinite(quantity) && quantity > 0 && (orderType === 'market' || (Number.isFinite(limitPrice) && limitPrice > 0))

  const intent = useMemo<TradeIntent>(
    () => ({
      direction,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      limitPrice: orderType === 'market' ? marketPrice : Number.isFinite(limitPrice) ? limitPrice : 0,
      orderType,
      sideLabel,
      canSubmit,
    }),
    [direction, quantity, limitPrice, marketPrice, orderType, sideLabel, canSubmit],
  )

  const setLong = () => setDirection('long')
  const setShort = () => setDirection('short')
  const quickBuy = () => {
    setDirection('long')
    setPriceText(marketPrice.toFixed(2))
  }
  const quickSell = () => {
    setDirection('short')
    setPriceText(marketPrice.toFixed(2))
  }

  const execute = (action: TradeAction) => {
    if (!canSubmit) return
    const payload: TradeRequest = {
      asset,
      action,
      direction: intent.direction,
      quantity: intent.quantity,
      orderType,
      limitPrice: intent.limitPrice,
      stopLoss,
      takeProfit,
      timestamp: Date.now(),
    }
    onExecute(payload)
  }

  return {
    direction,
    orderType,
    quantityText,
    priceText: effectivePriceText,
    stopLossText,
    targetText,
    intent,
    setQuantityText,
    setPriceText,
    setStopLossText,
    setTargetText,
    setOrderType,
    setLong,
    setShort,
    quickBuy,
    quickSell,
    execute,
  }
}
