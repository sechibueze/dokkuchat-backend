import { adminDocs } from '../admins/admin.docs';
import { authDocs } from '../auth/auth.docs';
import { rbacDocs } from '../rbac/rbac.docs';
import { userDocs } from '../users/user.docs';

export const allRouteDocs = [...authDocs, ...userDocs, ...adminDocs, ...rbacDocs];
