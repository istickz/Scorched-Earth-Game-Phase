import { type AIDifficulty } from '@/types';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';

/**
 * Progress data structure
 */
interface DifficultyProgress {
  completedLevels: number[]; // Array of completed level indices (0-based)
  lastPlayedLevel?: number; // Last level index that was played
}

interface ProgressData {
  solo?: {
    [difficulty: string]: DifficultyProgress;
  };
  local?: DifficultyProgress;
  multiplayer?: DifficultyProgress;
}

const STORAGE_KEY = 'artillery-battle-progress';

/**
 * Manager for saving and loading level progress
 * Uses localStorage to persist progress across sessions
 */
export class ProgressManager {
  /**
   * Get all progress data
   * Migrates old format to new format if needed
   */
  private static getProgress(): ProgressData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return {};
      }
      
      const data = JSON.parse(stored);
      
      // Migrate old format to new format
      if (!data.solo && !data.local) {
        // Old format: { easy: {...}, medium: {...}, hard: {...}, twoPlayers: {...} }
        const migrated: ProgressData = {
          solo: {},
        };
        
        // Move difficulty-based progress to solo
        if (data.easy) migrated.solo!.easy = data.easy;
        if (data.medium) migrated.solo!.medium = data.medium;
        if (data.hard) migrated.solo!.hard = data.hard;
        
        // Move twoPlayers to local if exists (migrate old key name)
        if (data.twoPlayers) {
          migrated.local = data.twoPlayers;
        } else if (data.local) {
          migrated.local = data.local;
        }
        
        // Save migrated data
        this.saveProgress(migrated);
        return migrated;
      }
      
      // Migrate twoPlayers key to local if exists
      if (data.twoPlayers && !data.local) {
        data.local = data.twoPlayers;
        delete data.twoPlayers;
        this.saveProgress(data);
      }
      
      return data;
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
   * Mark a level as completed for a specific difficulty in solo mode
   */
  static completeLevel(difficulty: AIDifficulty, levelIndex: number): void {
    const progress = this.getProgress();
    
    if (!progress.solo) {
      progress.solo = {};
    }
    
    if (!progress.solo[difficulty]) {
      progress.solo[difficulty] = { completedLevels: [] };
    }

    const completedLevels = progress.solo[difficulty].completedLevels;
    if (!completedLevels.includes(levelIndex)) {
      completedLevels.push(levelIndex);
      completedLevels.sort((a, b) => a - b); // Keep sorted
    }

    progress.solo[difficulty].lastPlayedLevel = levelIndex;
    this.saveProgress(progress);
  }

  /**
   * Check if a level is completed for a specific difficulty in solo mode
   */
  static isLevelCompleted(difficulty: AIDifficulty, levelIndex: number): boolean {
    const progress = this.getProgress();
    const difficultyProgress = progress.solo?.[difficulty];
    
    if (!difficultyProgress) {
      return false;
    }

    return difficultyProgress.completedLevels.includes(levelIndex);
  }

  /**
   * Get the number of completed levels for a difficulty in solo mode
   */
  static getCompletedLevelsCount(difficulty: AIDifficulty): number {
    const progress = this.getProgress();
    const difficultyProgress = progress.solo?.[difficulty];
    
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
   * Get all completed level indices for a difficulty in solo mode
   */
  static getCompletedLevels(difficulty: AIDifficulty): number[] {
    const progress = this.getProgress();
    const difficultyProgress = progress.solo?.[difficulty];
    
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

  /**
   * Mark a level as completed for 2 players mode (local multiplayer)
   */
  static completeLevelTwoPlayers(levelIndex: number): void {
    const progress = this.getProgress();
    
    if (!progress.local) {
      progress.local = { completedLevels: [] };
    }

    const completedLevels = progress.local.completedLevels;
    if (!completedLevels.includes(levelIndex)) {
      completedLevels.push(levelIndex);
      completedLevels.sort((a, b) => a - b); // Keep sorted
    }

    progress.local.lastPlayedLevel = levelIndex;
    this.saveProgress(progress);
  }

  /**
   * Check if a level is completed for 2 players mode (local multiplayer)
   */
  static isLevelCompletedTwoPlayers(levelIndex: number): boolean {
    const progress = this.getProgress();
    const localProgress = progress.local;
    
    if (!localProgress) {
      return false;
    }

    return localProgress.completedLevels.includes(levelIndex);
  }

  /**
   * Get the number of completed levels for 2 players mode (local multiplayer)
   */
  static getCompletedLevelsCountTwoPlayers(): number {
    const progress = this.getProgress();
    const localProgress = progress.local;
    
    if (!localProgress) {
      return 0;
    }

    return localProgress.completedLevels.length;
  }

  /**
   * Get the highest unlocked level index for 2 players mode (completed + 1)
   * Level 0 is always unlocked
   */
  static getHighestUnlockedLevelTwoPlayers(): number {
    const completedCount = this.getCompletedLevelsCountTwoPlayers();
    // If no levels completed, level 0 is unlocked
    // If N levels completed, levels 0..N are unlocked (so N+1 is the next one)
    return Math.min(completedCount, SINGLEPLAYER_LEVELS.length - 1);
  }

  /**
   * Check if a level is unlocked for 2 players mode
   * Level 0 is always unlocked
   */
  static isLevelUnlockedTwoPlayers(levelIndex: number): boolean {
    if (levelIndex === 0) {
      return true; // First level is always unlocked
    }

    const highestUnlocked = this.getHighestUnlockedLevelTwoPlayers();
    return levelIndex <= highestUnlocked;
  }

  /**
   * Get all completed level indices for 2 players mode (local multiplayer)
   */
  static getCompletedLevelsTwoPlayers(): number[] {
    const progress = this.getProgress();
    const localProgress = progress.local;
    
    if (!localProgress) {
      return [];
    }

    return [...localProgress.completedLevels];
  }

  /**
   * Mark a level as completed for multiplayer mode
   */
  static completeLevelMultiplayer(levelIndex: number): void {
    const progress = this.getProgress();
    
    if (!progress.multiplayer) {
      progress.multiplayer = { completedLevels: [] };
    }

    const completedLevels = progress.multiplayer.completedLevels;
    if (!completedLevels.includes(levelIndex)) {
      completedLevels.push(levelIndex);
      completedLevels.sort((a, b) => a - b); // Keep sorted
    }

    progress.multiplayer.lastPlayedLevel = levelIndex;
    this.saveProgress(progress);
  }

  /**
   * Check if a level is completed for multiplayer mode
   */
  static isLevelCompletedMultiplayer(levelIndex: number): boolean {
    const progress = this.getProgress();
    const multiplayerProgress = progress.multiplayer;
    
    if (!multiplayerProgress) {
      return false;
    }

    return multiplayerProgress.completedLevels.includes(levelIndex);
  }

  /**
   * Get the number of completed levels for multiplayer mode
   */
  static getCompletedLevelsCountMultiplayer(): number {
    const progress = this.getProgress();
    const multiplayerProgress = progress.multiplayer;
    
    if (!multiplayerProgress) {
      return 0;
    }

    return multiplayerProgress.completedLevels.length;
  }

  /**
   * Get the highest unlocked level index for multiplayer mode (completed + 1)
   * Level 0 is always unlocked
   */
  static getHighestUnlockedLevelMultiplayer(): number {
    const completedCount = this.getCompletedLevelsCountMultiplayer();
    // If no levels completed, level 0 is unlocked
    // If N levels completed, levels 0..N are unlocked (so N+1 is the next one)
    return Math.min(completedCount, SINGLEPLAYER_LEVELS.length - 1);
  }

  /**
   * Check if a level is unlocked for multiplayer mode
   * Level 0 is always unlocked
   */
  static isLevelUnlockedMultiplayer(levelIndex: number): boolean {
    if (levelIndex === 0) {
      return true; // First level is always unlocked
    }

    const highestUnlocked = this.getHighestUnlockedLevelMultiplayer();
    return levelIndex <= highestUnlocked;
  }

  /**
   * Get all completed level indices for multiplayer mode
   */
  static getCompletedLevelsMultiplayer(): number[] {
    const progress = this.getProgress();
    const multiplayerProgress = progress.multiplayer;
    
    if (!multiplayerProgress) {
      return [];
    }

    return [...multiplayerProgress.completedLevels];
  }
}

