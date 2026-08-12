import { defineStore, storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../api'

export interface Account {
  id: string
  name: string
  cloudflareAccountId: string
  cloudflareTokenId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAccountInput {
  name: string
  cloudflareAccountId: string
  token: string
}

export interface UpdateAccountInput {
  name?: string
  cloudflareAccountId?: string
  token?: string
}

const STORAGE_KEY = 'cftm-selected-account'
const ALL = 'all'

export const useAccountStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const selectedAccountId = ref<string>(localStorage.getItem(STORAGE_KEY) || ALL)

  const selectedAccount = computed(() =>
    accounts.value.find(a => a.id === selectedAccountId.value) || null)

  const selectedCloudflareAccountId = computed(() =>
    selectedAccount.value?.cloudflareAccountId ?? null)

  async function loadAccounts() {
    loading.value = true
    try {
      accounts.value = await api.get<Account[]>('/accounts')
    }
    finally {
      loading.value = false
    }
  }

  async function createAccount(input: CreateAccountInput) {
    const account = await api.post<Account>('/accounts', input)
    accounts.value.push(account)
    return account
  }

  async function updateAccount(id: string, input: UpdateAccountInput) {
    const account = await api.put<Account>(`/accounts/${id}`, input)
    const idx = accounts.value.findIndex(a => a.id === id)
    if (idx !== -1)
      accounts.value[idx] = account
    return account
  }

  async function deleteAccount(id: string) {
    await api.delete(`/accounts/${id}`)
    accounts.value = accounts.value.filter(a => a.id !== id)
    if (selectedAccountId.value === id)
      setSelected(ALL)
  }

  function setSelected(id: string) {
    selectedAccountId.value = id
    localStorage.setItem(STORAGE_KEY, id)
  }

  return {
    accounts,
    loading,
    selectedAccountId,
    selectedAccount,
    selectedCloudflareAccountId,
    loadAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    setSelected,
  }
})

export function useAccountStoreRefs() {
  const store = useAccountStore()
  return storeToRefs(store)
}
