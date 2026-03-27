/**
 * Supabase Database type definitions.
 * TODO: Generate from Supabase schema with `npx supabase gen types typescript`
 * For now, define minimal types to unblock development.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          project_id: string;
          name: string;
          description: string | null;
          status: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'project_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      tasks: {
        Row: {
          task_id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string | null;
          assignee_id: string | null;
          parent_task_id: string | null;
          position: number;
          start_date: string | null;
          due_date: string | null;
          effort: number | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'task_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['project_members']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>;
      };
      notifications: {
        Row: {
          notification_id: string;
          user_id: string;
          project_id: string | null;
          sender_id: string | null;
          type: string;
          reference_type: string | null;
          reference_id: string | null;
          message: string;
          action: string | null;
          metadata: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'notification_id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      users: {
        Row: {
          user_id: string;
          email: string;
          full_name: string;
          name: string | null;
          avatar_url: string | null;
          firebase_uid: string | null;
          supabase_uid: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'user_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      plans: {
        Row: {
          plan_id: string;
          project_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'plan_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
      };
      comments: {
        Row: {
          comment_id: string;
          task_id: string;
          user_id: string;
          content: string;
          parent_comment_id: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'comment_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
      };
      attachments: {
        Row: {
          attachment_id: string;
          task_id: string;
          uploaded_by: string;
          file_name: string;
          file_url: string;
          file_size: number;
          file_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attachments']['Row'], 'attachment_id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>;
      };
      systems: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['systems']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['systems']['Insert']>;
      };
      modules: {
        Row: {
          id: string;
          system_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['modules']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['modules']['Insert']>;
      };
      design_documents: {
        Row: {
          id: string;
          module_id: string;
          name: string;
          description: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['design_documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['design_documents']['Insert']>;
      };
      screens: {
        Row: {
          id: string;
          document_id: string;
          name: string;
          description: string | null;
          svg_content: string | null;
          content_type: string;
          sort_order: number;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['screens']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['screens']['Insert']>;
      };
      components: {
        Row: {
          id: string;
          screen_id: string;
          name: string;
          descriptions: Json | null;
          component_type: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['components']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['components']['Insert']>;
      };
      flows: {
        Row: {
          id: string;
          document_id: string;
          name: string;
          description: string | null;
          steps: Json;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['flows']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['flows']['Insert']>;
      };
      tags: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tags']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tags']['Insert']>;
      };
      external_links: {
        Row: {
          id: string;
          document_id: string;
          url: string;
          title: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['external_links']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['external_links']['Insert']>;
      };
      document_audit: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          old_data: Json | null;
          new_data: Json | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: Omit<Database['public']['Tables']['document_audit']['Row'], 'id' | 'changed_at'>;
        Update: Partial<Database['public']['Tables']['document_audit']['Insert']>;
      };
      field_mappings: {
        Row: {
          id: string;
          component_id: string;
          field_name: string;
          field_type: string;
          source: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['field_mappings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['field_mappings']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
