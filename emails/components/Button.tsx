import { Link } from '@react-email/components';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  variant?: 'primary' | 'secondary' | 'white';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const Button = ({
  href,
  children,
  backgroundColor,
  textColor,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
}: ButtonProps) => {
  // Default colors based on variant
  const getBackgroundColor = () => {
    if (backgroundColor) return backgroundColor;
    switch (variant) {
      case 'primary':
        return '#dc2626';
      case 'secondary':
        return '#475569';
      case 'white':
        return '#ffffff';
      default:
        return '#dc2626';
    }
  };

  const getTextColor = () => {
    if (textColor) return textColor;
    return variant === 'white' ? '#dc2626' : '#ffffff';
  };

  // Padding based on size
  const getPadding = () => {
    switch (size) {
      case 'small':
        return '10px 24px';
      case 'medium':
        return '14px 32px';
      case 'large':
        return '16px 40px';
      default:
        return '14px 32px';
    }
  };

  const buttonStyle = {
    display: fullWidth ? 'block' : 'inline-block',
    padding: getPadding(),
    backgroundColor: getBackgroundColor(),
    color: getTextColor(),
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center' as const,
    ...(fullWidth && { width: '100%' }),
  };

  return (
    <Link href={href} style={buttonStyle}>
      {children}
    </Link>
  );
};
