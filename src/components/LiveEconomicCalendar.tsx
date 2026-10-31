import { useEffect, useRef } from 'react';
import './live-economic-calendar.css';

declare global {
  interface Window {
    FinanceCalendarWidget?: { init?: () => void };
  }
}

const SCRIPT_ID = 'finance-calendar-widget-script';
const SCRIPT_URL = 'https://www.financecalendar.com/wp-json/fc/v1/widget';

export default function LiveEconomicCalendar() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const init = () => {
      if (!cancelled) window.FinanceCalendarWidget?.init?.();
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.FinanceCalendarWidget?.init) {
        init();
      } else {
        existing.addEventListener('load', init, { once: true });
      }
      return () => { cancelled = true; };
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      if (hostRef.current) {
        hostRef.current.innerHTML =
          '<p class="live-calendar__error">Kalender gagal dimuat. Periksa koneksi atau coba muat ulang halaman.</p>';
      }
    };
    document.body.appendChild(script);

    return () => { cancelled = true; };
  }, []);

  return (
    <section className="live-calendar">
      <div className="live-calendar__heading">
        <div>
          <p className="live-calendar__eyebrow">MARKET EVENTS</p>
          <h2>Live Economic Calendar</h2>
          <p className="live-calendar__description">
            Jadwal rilis ekonomi, tingkat dampak, konsensus, data sebelumnya, dan hasil aktual jika tersedia.
          </p>
        </div>
        <span className="live-calendar__status">
          <span className="live-calendar__dot" />
          Live data source
        </span>
      </div>

      <div className="live-calendar__widget" ref={hostRef}>
        <div
          data-fc-widget
          data-days="14"
          data-title="Veltrix Warfare — Economic Calendar"
        />
      </div>
      <p className="live-calendar__attribution">
        Data and calendar widget by{' '}
        <a href="https://www.financecalendar.com/" target="_blank" rel="noopener noreferrer">
          Finance Calendar
        </a>
        . Jadwal dan kelengkapan forecast/actual mengikuti ketersediaan sumber data.
      </p>
    </section>
  );
}
