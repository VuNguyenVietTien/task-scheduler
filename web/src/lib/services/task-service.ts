import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const taskService = {
  async getTask(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:users!tasks_assignee_id_fkey(*)')
      .eq('task_id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getTasks(supabase: Supabase, filters: { project_id?: string; assignee_id?: string; status?: string }) {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.assignee_id) query = query.eq('assignee_id', filters.assignee_id);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getTasksForProject(supabase: Supabase, projectId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('priority_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getSubtasks(supabase: Supabase, taskId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', taskId)
      .order('priority_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createTask(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTask(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('tasks')
      .update(input as never)
      .eq('task_id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTaskStatus(supabase: Supabase, id: string, status: string) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status } as never)
      .eq('task_id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTaskEffort(supabase: Supabase, id: string, effort: number) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ effort } as never)
      .eq('task_id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTask(supabase: Supabase, id: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true } as never)
      .eq('task_id', id);
    if (error) throw error;
    return true;
  },

  async reorderTasks(supabase: Supabase, tasks: { task_id: string; priority_order: number }[]) {
    const updates = tasks.map(({ task_id, priority_order }) =>
      supabase
        .from('tasks')
        .update({ priority_order } as never)
        .eq('task_id', task_id)
    );
    await Promise.all(updates);
    return true;
  },
};
