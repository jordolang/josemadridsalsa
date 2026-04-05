import { ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { LoginScreen } from '@/components/LoginScreen';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, isLoading, refreshSession } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#d32f2f" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <LoginScreen 
        title="Authentication Required" 
        onLoginSuccess={refreshSession} 
      />
    );
  }

  return <>{children}</>;
}
