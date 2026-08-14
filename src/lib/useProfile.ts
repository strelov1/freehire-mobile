import { useQuery } from '@tanstack/react-query';

import { getProfile } from './api';
import { useAuth } from './authStore';

/**
 * The signed-in user's saved profile, for the Filters screen's "Apply profile"
 * button. `enabled: !!user` keeps it from ever firing for a signed-out visitor
 * (the endpoint would just throw `ApiError(401)`).
 */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: !!user,
  });
}
