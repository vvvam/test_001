import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatUserPreferences {
  defaultRoleId: string | null;
  defaultProviderId: string | null;
}

interface ChatUserPrefsState extends ChatUserPreferences {
  setDefaultRole: (roleId: string) => void;
  setDefaultProvider: (providerId: string) => void;
  resetPreferences: () => void;
}

const DEFAULT_PREFERENCES: ChatUserPreferences = {
  defaultRoleId: null,
  defaultProviderId: 'Copy2AI' // 默认使用Kimi
};

export const useChatUserPrefsStore = create<ChatUserPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      
      setDefaultRole: (roleId: string) => set({ defaultRoleId: roleId }),
      
      setDefaultProvider: (providerId: string) => set({ defaultProviderId: providerId }),
      
      resetPreferences: () => set(DEFAULT_PREFERENCES)
    }),
    {
      name: 'chat-user-preferences'
    }
  )
); 