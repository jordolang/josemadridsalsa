import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class", ".dark"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			salsa: {
  				'50': '#fef2f2',
  				'100': '#fde6e6',
  				'200': '#fbd1d1',
  				'300': '#f7a3a3',
  				'400': '#f27474',
  				'500': '#e53e3e',
  				'600': '#d53030',
  				'700': '#b91c1c',
  				'800': '#991b1b',
  				'900': '#7f1d1d',
  				'950': '#450a0a'
  			},
  			verde: {
  				'50': '#f0fdf4',
  				'100': '#dcfce7',
  				'200': '#bbf7d0',
  				'300': '#86efac',
  				'400': '#4ade80',
  				'500': '#22c55e',
  				'600': '#16a34a',
  				'700': '#15803d',
  				'800': '#166534',
  				'900': '#14532d',
  				'950': '#052e16'
  			},
  			chile: {
  				'50': '#fffbeb',
  				'100': '#fef3c7',
  				'200': '#fed490',
  				'300': '#fdc559',
  				'400': '#fcb424',
  				'500': '#f59e0b',
  				'600': '#d97706',
  				'700': '#b45309',
  				'800': '#92400e',
  				'900': '#78350f',
  				'950': '#451a03'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-montserrat)',
  				'Montserrat',
  				'system-ui',
  				'sans-serif'
  			],
  			serif: [
  				'var(--font-volkhov)',
  				'Volkhov',
  				'Georgia',
  				'serif'
  			],
  			mono: [
  				'var(--font-roboto-mono)',
  				'Roboto Mono',
  				'Menlo',
  				'monospace'
  			]
  		},
  		fontSize: {
  			// Fluid typography using clamp() for responsive scaling
  			// Format: [fontSize, { lineHeight, letterSpacing }]
  			// Mobile-first: ensures min 16px for body text
  			'xs': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.5', letterSpacing: '0.01em' }],
  			'sm': ['clamp(0.875rem, 0.825rem + 0.25vw, 1rem)', { lineHeight: '1.5', letterSpacing: '0.01em' }],
  			'base': ['clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', { lineHeight: '1.6', letterSpacing: '0' }],
  			'lg': ['clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem)', { lineHeight: '1.6', letterSpacing: '0' }],
  			'xl': ['clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
  			'2xl': ['clamp(1.5rem, 1.35rem + 0.75vw, 1.875rem)', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
  			'3xl': ['clamp(1.875rem, 1.65rem + 1.125vw, 2.25rem)', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
  			'4xl': ['clamp(2.25rem, 1.95rem + 1.5vw, 3rem)', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
  			'5xl': ['clamp(3rem, 2.55rem + 2.25vw, 3.75rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
  			'6xl': ['clamp(3.75rem, 3.15rem + 3vw, 4.5rem)', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
  			'7xl': ['clamp(4.5rem, 3.75rem + 3.75vw, 6rem)', { lineHeight: '1', letterSpacing: '-0.04em' }],
  			'8xl': ['clamp(6rem, 4.95rem + 5.25vw, 8rem)', { lineHeight: '1', letterSpacing: '-0.05em' }],
  			'9xl': ['clamp(8rem, 6.6rem + 7vw, 10rem)', { lineHeight: '1', letterSpacing: '-0.05em' }],
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.5s ease-in-out',
  			'slide-up': 'slideUp 0.5s ease-out',
  			'bounce-gentle': 'bounceGentle 2s infinite',
  			'slide-in-right': 'slideInRight 0.5s ease-out',
  			'slide-in-left': 'slideInLeft 0.5s ease-out',
  			'wiggle': 'wiggle 1s ease-in-out',
  			'bell-ring': 'bellRing 0.9s ease-in-out',
  			'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
  			'spin-slow': 'spinSlow 3s linear infinite',
  			'swing': 'swing 1s ease-in-out',
  			'marquee': 'marquee linear infinite',
  			'progress-fill': 'progressFill 0.3s ease-out',
  			'progress-pulse': 'progressPulse 1.5s ease-in-out infinite',
  			'progress-shimmer': 'progressShimmer 2s linear infinite'
  		},
  		keyframes: {
  			// A short swing for the notification bell when a new item arrives. Pivots from the
  			// top so it reads as the bell swinging rather than the whole icon sliding.
  			bellRing: {
  				'0%, 100%': { transform: 'rotate(0deg)' },
  				'15%': { transform: 'rotate(14deg)' },
  				'30%': { transform: 'rotate(-12deg)' },
  				'45%': { transform: 'rotate(9deg)' },
  				'60%': { transform: 'rotate(-6deg)' },
  				'75%': { transform: 'rotate(3deg)' }
  			},
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(20px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			bounceGentle: {
  				'0%, 20%, 50%, 80%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'40%': {
  					transform: 'translateY(-10px)'
  				},
  				'60%': {
  					transform: 'translateY(-5px)'
  				}
  			},
  			slideInRight: {
  				'0%': {
  					transform: 'translateX(100px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateX(0)',
  					opacity: '1'
  				}
  			},
  			slideInLeft: {
  				'0%': {
  					transform: 'translateX(-100px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateX(0)',
  					opacity: '1'
  				}
  			},
  			wiggle: {
  				'0%, 100%': {
  					transform: 'rotate(-3deg)'
  				},
  				'50%': {
  					transform: 'rotate(3deg)'
  				}
  			},
  			pulseSlow: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.7'
  				}
  			},
  			spinSlow: {
  				'0%': {
  					transform: 'rotate(0deg)'
  				},
  				'100%': {
  					transform: 'rotate(360deg)'
  				}
  			},
  			swing: {
  				'0%, 100%': {
  					transform: 'rotate(0deg)'
  				},
  				'20%': {
  					transform: 'rotate(15deg)'
  				},
  				'40%': {
  					transform: 'rotate(-10deg)'
  				},
  				'60%': {
  					transform: 'rotate(5deg)'
  				},
  				'80%': {
  					transform: 'rotate(-5deg)'
  				}
  			},
  			marquee: {
  				'0%': {
  					transform: 'translateX(0)'
  				},
  				'100%': {
  					transform: 'translateX(-50%)'
  				}
  			},
  			progressFill: {
  				'0%': {
  					transform: 'scaleX(0)',
  					transformOrigin: 'left'
  				},
  				'100%': {
  					transform: 'scaleX(1)',
  					transformOrigin: 'left'
  				}
  			},
  			progressPulse: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.5'
  				}
  			},
  			progressShimmer: {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;