import { Project } from '@/data/mockProjects';

const STORAGE_KEYS = {
  PROJECTS: 'taskScheduler_projects',
  USER_SETTINGS: 'taskScheduler_userSettings',
  RECENT_SEARCHES: 'taskScheduler_recentSearches'
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

class StorageManager {
  private static instance: StorageManager;
  private isAvailable: boolean;

  private constructor() {
    this.isAvailable = this.checkStorageAvailability();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  private checkStorageAvailability(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  public setItem<T>(key: StorageKey, value: T): boolean {
    if (!this.isAvailable) return false;

    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(STORAGE_KEYS[key], serialized);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  public getItem<T>(key: StorageKey): T | null {
    if (!this.isAvailable) return null;

    try {
      const item = localStorage.getItem(STORAGE_KEYS[key]);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  public removeItem(key: StorageKey): boolean {
    if (!this.isAvailable) return false;

    try {
      localStorage.removeItem(STORAGE_KEYS[key]);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }

  public clear(): boolean {
    if (!this.isAvailable) return false;

    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  // Project-specific methods
  public getProjects(): Project[] {
    return this.getItem<Project[]>('PROJECTS') || [];
  }

  public saveProjects(projects: Project[]): boolean {
    return this.setItem('PROJECTS', projects);
  }

  public addProject(project: Project): boolean {
    const projects = this.getProjects();
    projects.push(project);
    return this.saveProjects(projects);
  }

  public updateProject(updatedProject: Project): boolean {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) {
      projects[index] = updatedProject;
      return this.saveProjects(projects);
    }
    return false;
  }

  public deleteProject(projectId: string): boolean {
    const projects = this.getProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);
    return this.saveProjects(filteredProjects);
  }
}

export const storage = StorageManager.getInstance();
