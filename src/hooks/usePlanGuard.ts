import { useAuth } from '@/context/AuthContext';

type PlanTier = 'basico' | 'medio' | 'premium';

const PLAN_WEIGHTS: Record<PlanTier, number> = {
  basico: 1,
  medio: 2,
  premium: 3,
};

export function usePlanGuard(requiredPlan: PlanTier) {
  const { plan } = useAuth();

  if (!plan) {
    return { hasAccess: false, userPlan: null };
  }

  const userWeight = PLAN_WEIGHTS[plan] || 1;
  const requiredWeight = PLAN_WEIGHTS[requiredPlan] || 1;

  return {
    hasAccess: userWeight >= requiredWeight,
    userPlan: plan,
  };
}
