import { AuthLayout } from '@/components/templates/auth-layout';
import { LoginForm } from '@/components/organisms/login-form';

export default function LoginPage(): JSX.Element {
  return (
    <AuthLayout title="Sign in">
      <LoginForm />
    </AuthLayout>
  );
}
