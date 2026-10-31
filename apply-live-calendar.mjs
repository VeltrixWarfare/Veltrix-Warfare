import { readFileSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'

const appPath = 'src/App.tsx'
if (!existsSync(appPath)) {
  console.error('Run this script from the root of the Veltrix Warfare repository.')
  process.exit(1)
}

let source = readFileSync(appPath, 'utf8')
const importLine = "import LiveEconomicCalendar from './components/LiveEconomicCalendar'"

if (!source.includes(importLine)) {
  const anchor = "import { supabase } from './lib/supabase'"
  if (!source.includes(anchor)) {
    console.error('Could not find the expected Supabase import in src/App.tsx. No files were changed.')
    process.exit(1)
  }
  source = source.replace(anchor, `${anchor}\n${importLine}`)
}

const startMarker = '<div className="glass-panel content-panel"><div className="panel-heading"><div><span className="section-kicker">CALENDAR INTERFACE</span><h3>Economic calendar</h3></div><CalendarDays size={17}/></div>'
const endMarker = '<p className="fine-print">Sample events only. Times and event descriptions are not a verified calendar.</p></div>'
const start = source.indexOf(startMarker)
const end = start < 0 ? -1 : source.indexOf(endMarker, start)

if (start < 0 || end < 0) {
  if (source.includes('<LiveEconomicCalendar />')) {
    console.log('Live Economic Calendar is already integrated. No changes needed.')
    process.exit(0)
  }
  console.error('Could not find the original demo calendar block. No files were changed.')
  console.error('Use the manual integration instructions in README-INTEGRATION.md.')
  process.exit(1)
}

const replacement = '<LiveEconomicCalendar />'
source = source.slice(0, start) + replacement + source.slice(end + endMarker.length)
writeFileSync(appPath, source, 'utf8')
console.log('Integrated Live Economic Calendar into src/App.tsx.')
console.log('Next: configure TE_API_KEY in Vercel Environment Variables and deploy.')
