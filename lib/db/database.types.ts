/**
 * Typed Postgres schema for the Supabase client. Mirrors supabase/migrations.
 * Hand-maintained (small schema); regenerate with `supabase gen types` if the
 * schema grows. Column names are snake_case — mappers translate to camelCase
 * domain DTOs at the db boundary.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type ProjectStatus = "draft" | "planning" | "active" | "completed" | "archived";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "critical";
type RecommendationStatus = "active" | "dismissed" | "applied";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          goal: string;
          description: string;
          status: ProjectStatus;
          timeline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          goal: string;
          description?: string;
          status?: ProjectStatus;
          timeline?: string | null;
        };
        Update: {
          title?: string;
          goal?: string;
          description?: string;
          status?: ProjectStatus;
          timeline?: string | null;
        };
        Relationships: [];
      };
      workstreams: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string;
          position?: number;
        };
        Update: { name?: string; description?: string; position?: number };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          workstream_id: string | null;
          title: string;
          description: string;
          priority: TaskPriority;
          status: TaskStatus;
          estimated_hours: number | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          workstream_id?: string | null;
          title: string;
          description?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
          estimated_hours?: number | null;
          position?: number;
        };
        Update: {
          workstream_id?: string | null;
          title?: string;
          description?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
          estimated_hours?: number | null;
          position?: number;
        };
        Relationships: [];
      };
      dependencies: {
        Row: {
          id: string;
          project_id: string;
          task_id: string;
          depends_on_task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id: string;
          depends_on_task_id: string;
        };
        Update: { task_id?: string; depends_on_task_id?: string };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          deadline: string | null;
          completed: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          deadline?: string | null;
          completed?: boolean;
          position?: number;
        };
        Update: {
          title?: string;
          deadline?: string | null;
          completed?: boolean;
          position?: number;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          project_id: string;
          message: string;
          reasoning: string;
          impact: string;
          status: RecommendationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          message: string;
          reasoning: string;
          impact?: string;
          status?: RecommendationStatus;
        };
        Update: { status?: RecommendationStatus };
        Relationships: [];
      };
      project_history: {
        Row: {
          id: string;
          project_id: string;
          event: string;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          event: string;
          snapshot?: Json;
        };
        Update: { snapshot?: Json };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      owns_project: {
        Args: { pid: string };
        Returns: boolean;
      };
    };
    Enums: {
      project_status: ProjectStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      recommendation_status: RecommendationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
