import { supabase } from '../lib/supabase'

export const authService = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },

  async updateProfile(userId, updates) {
    // Exclude role modifications to enforce security policy
    const { role, ...allowedUpdates } = updates
    const { data, error } = await supabase
      .from('profiles')
      .update(allowedUpdates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getAllProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }
}
