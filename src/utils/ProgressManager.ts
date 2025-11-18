import { type AIDifficulty } from '@/types';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';

/**
 * Progress data structure
 */
interface ProgressData {
  [difficulty: string]: {
    completedLevels: number[]; // Array of completed level indices (0-based)
    lastPlayedLevel?: number; // Last level index that was played
  };
}

const STORAGE_KEY = 'artillery-battle-progress';

/**
 * Manager for saving and loading level progress
 * Uses localStorage to persist progress across sessions
 */
export class ProgressManager {
  /**
   * Get all progress data
   */
  private static getProgress(): ProgressData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save progress data
   */
  private static saveProgress(progress: ProgressData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  /**
   * Mark a level as completed for a specific difficulty
   */
  static completeLevel(difficulty: AIDifficulty, levelIndex: number): void {
    const progress = this.getProgress();
    
    if (!progress[difficulty]) {
      progress[difficulty] = { completedLevels: [] };
    }

    const completedLevels = progress[difficulty].completedLevels;
    if (!completedLevels.includes(levelIndex)) {
      completedLevels.push(levelIndex);
      completedLevels.sort((a, b) => a - b); // Keep sorted
    }

    progress[difficulty].lastPlayedLevel = levelIndex;
    this.saveProgress(progress);
  }

  /**
   * Check if a level is completed for a specific difficulty
   */
  static isLevelCompleted(difficulty: AIDifficulty, levelIndex: number): boolean {
    const progress = this.getProgress();
    const difficultyProgress = progress[difficulty];
    
    if (!difficultyProgress) {
      return false;
    }

    return difficultyProgress.completedLevels.includes(levelIndex);
  }

  /**
   * Get the number of completed levels for a difficulty
   */
  static getCompletedLevelsCount(difficulty: AIDifficulty): number {
    const progress = this.getProgress();
    const difficultyProgress = progress[difficulty];
    
    if (!difficultyProgress) {
      return 0;
    }

    return difficultyProgress.completedLevels.length;
  }

  /**
   * Get the highest unlocked level index (completed + 1)
   * Level 0 is always unlocked
   */
  static getHighestUnlockedLevel(difficulty: AIDifficulty): number {
    const completedCount = this.getCompletedLevelsCount(difficulty);
    // If no levels completed, level 0 is unlocked
    // If N levels completed, levels 0..N are unlocked (so N+1 is the next one)
    return Math.min(completedCount, SINGLEPLAYER_LEVELS.length - 1);
  }

  /**
   * Check if a level is unlocked for a specific difficulty
   * Level 0 is always unlocked
   */
  static isLevelUnlocked(difficulty: AIDifficulty, levelIndex: number): boolean {
    if (levelIndex === 0) {
      return true; // First level is always unlocked
    }

    const highestUnlocked = this.getHighestUnlockedLevel(difficulty);
    return levelIndex <= highestUnlocked;
  }

  /**
   * Get all completed level indices for a difficulty
   */
  static getCompletedLevels(difficulty: AIDifficulty): number[] {
    const progress = this.getProgress();
    const difficultyProgress = progress[difficulty];
    
    if (!difficultyProgress) {
      return [];
    }

    return [...difficultyProgress.completedLevels];
  }

  /**
   * Clear all progress (for testing/reset)
   */
  static clearProgress(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear progress:', error);
    }
  }
}

