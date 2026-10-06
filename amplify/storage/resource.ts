import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'diaryImages',
  access: (allow) => ({
    'public/*': [
      allow.guest.to(['read', 'write', 'delete']),
    ],
  })
});
