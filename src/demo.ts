export type Instrument = { symbol: string; name: string; price: string; change: string; positive: boolean; category: string; points: number[] }

export const instruments: Instrument[] = [
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', price: '2,754.21', change: '+0.34%', positive: true, category: 'Metals', points: [4,7,5,10,8,13,12,17,14,21,19,24,22,28] },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', price: '1.0824', change: '+0.12%', positive: true, category: 'Forex', points: [8,6,9,7,11,10,12,9,14,13,15,12,17,18] },
  { symbol: 'GBPUSD', name: 'Pound / US Dollar', price: '1.2948', change: '+0.21%', positive: true, category: 'Forex', points: [6,8,7,11,9,14,12,15,17,14,18,16,20,22] },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', price: '149.32', change: '-0.18%', positive: false, category: 'Forex', points: [22,20,23,18,20,16,19,14,16,12,15,10,12,8] },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', price: '68,421.22', change: '+1.50%', positive: true, category: 'Crypto', points: [4,8,6,12,9,15,13,19,17,23,20,27,25,30] },
]

export const news = [
  { time: '08:30', title: 'Market structure: what traders should watch this session', tag: 'EDUCATION', impact: 'Medium' },
  { time: '10:00', title: 'Understanding USD strength across major pairs', tag: 'MARKET NOTE', impact: 'Low' },
  { time: '13:30', title: 'Economic calendar: review official event releases', tag: 'CALENDAR', impact: 'High' },
  { time: '15:00', title: 'Risk management: keeping a consistent process', tag: 'EDUCATION', impact: 'Medium' },
]

export const lessons = [
  { title: 'Trading Foundations', level: 'Beginner', duration: '18 min', desc: 'Build a clear framework for markets, orders, and risk.' },
  { title: 'Market Structure', level: 'Intermediate', duration: '24 min', desc: 'Read swings, breaks, and changing market conditions.' },
  { title: 'Liquidity Concepts', level: 'Intermediate', duration: '21 min', desc: 'Understand liquidity areas and common price reactions.' },
  { title: 'Risk & Position Sizing', level: 'Beginner', duration: '16 min', desc: 'Plan risk before considering any trade idea.' },
]
