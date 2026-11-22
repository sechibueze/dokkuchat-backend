export const Permission = {
  DocumentsRead: 'documents:read',
  DocumentsWrite: 'documents:write',
  DocumentsDelete: 'documents:delete',
  ConversationsRead: 'conversations:read',
  ConversationsWrite: 'conversations:write',
  UsageRead: 'usage:read',
  ToolsUse: 'tools:use',
  UsersRead: 'users:read',
  UsersWrite: 'users:write',
  UsersDelete: 'users:delete',
  UsersDeletePermanent: 'users:delete-permanent',
  RolesManage: 'roles:manage',
} as const;
export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'documents:read': 'View and download own documents',
  'documents:write': 'Upload and reprocess documents',
  'documents:delete': 'Delete own documents',
  'conversations:read': 'View own conversations',
  'conversations:write': 'Create conversations and ask questions',
  'usage:read': 'View own usage and budget',
  'tools:use': 'Let the assistant propose tool calls (approval required)',
  'users:read': 'List and view any user',
  'users:write': 'Update any user',
  'users:delete': 'Soft delete any user',
  'users:delete-permanent': 'Permanently delete any user',
  'roles:manage': 'Create, edit and delete roles',
};

export const SystemRole = { User: 'USER', Admin: 'ADMIN' } as const;

const everyPermission = Object.values(Permission);
export const SYSTEM_ROLES = [
  {
    name: SystemRole.User,
    description: 'Standard account',
    alwaysSyncAll: false,
    permissions: [
      Permission.DocumentsRead,
      Permission.DocumentsWrite,
      Permission.DocumentsDelete,
      Permission.ConversationsRead,
      Permission.ConversationsWrite,
      Permission.UsageRead,
      Permission.ToolsUse,
    ] as PermissionKey[],
  },
  {
    name: SystemRole.Admin,
    description: 'Platform administrator',
    alwaysSyncAll: true,
    permissions: everyPermission,
  },
];
