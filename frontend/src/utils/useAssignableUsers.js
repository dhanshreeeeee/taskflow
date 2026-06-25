import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Returns the list of users visible to the current actor for assignment purposes.
// Backend /auth/users already scopes: STAFF -> self, LEAD -> own team, ADMIN -> everyone.
export function useAssignableUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/users')
      .then((res) => setUsers(res.data.filter((u) => u.isActive)))
      .finally(() => setLoading(false));
  }, []);

  return { users, loading };
}
