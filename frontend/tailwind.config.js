/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design System — màu thương hiệu Viettel + trạng thái nghiệp vụ
        viettel: {
          red: '#EE0033',
          dark: '#1A1A1A',
        },
        danger: '#DC2626', // Danger Red (Lockdown, Reject, ACCESS_DENIED)
        success: '#16A34A',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
};
