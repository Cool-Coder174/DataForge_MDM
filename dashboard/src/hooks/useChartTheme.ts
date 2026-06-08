import { useDemoStore } from '../store/demoStore';

// Theme-aware Recharts tooltip styling so charts read correctly in both light
// and dark mode. Returns a richer surface (rounded, bordered, soft shadow) that
// matches the app's card language.
export function useChartTheme(): React.CSSProperties {
  const theme = useDemoStore((s) => s.theme);
  const base: React.CSSProperties = {
    borderRadius: 10,
    fontSize: 12,
    padding: '8px 12px',
    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.35)',
  };
  return theme === 'dark'
    ? { ...base, backgroundColor: '#1c1e24', borderColor: '#26272b', border: '1px solid #26272b', color: '#fafafa' }
    : { ...base, backgroundColor: '#ffffff', borderColor: '#e4e4e7', border: '1px solid #e4e4e7', color: '#18181b' };
}
