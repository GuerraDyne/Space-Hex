/**
 * PerformanceManager - Optimization system for Phase 3
 * Ensures 60fps smooth gameplay on mobile devices
 */

import { logger } from '../utils/Logger';

interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  frameTime: number;
  drawCalls: number;
  particleCount: number;
  textureMemory: number;
  timestamp: number;
}

interface PerformanceSettings {
  targetFps: number;
  maxParticles: number;
  enableShadows: boolean;
  enableParticles: boolean;
  enableAnimations: boolean;
  renderQuality: 'low' | 'medium' | 'high';
  maxDrawCalls: number;
}

interface AdaptiveSettings {
  particleReduction: number;
  animationSkipping: number;
  renderScaleReduction: number;
  effectsDisabled: boolean;
}

export class PerformanceManager {
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory: number = 60; // 1 second at 60fps
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private performanceCheckInterval: number = 1000; // 1 second
  private lastPerformanceCheck: number = 0;

  // Performance settings
  private settings: PerformanceSettings = {
    targetFps: 60,
    maxParticles: 500,
    enableShadows: true,
    enableParticles: true,
    enableAnimations: true,
    renderQuality: 'high',
    maxDrawCalls: 100
  };

  // Adaptive performance adjustments
  private adaptiveSettings: AdaptiveSettings = {
    particleReduction: 0,
    animationSkipping: 0,
    renderScaleReduction: 0,
    effectsDisabled: false
  };

  private isMonitoring: boolean = false;
  private performanceCallbacks: Set<(metrics: PerformanceMetrics) => void> = new Set();

  /**
   * Initialize the performance manager
   */
  async initialize(): Promise<void> {
    this.detectDeviceCapabilities();
    this.startMonitoring();
    
    logger.info('PERFORMANCE', 'PerformanceManager initialized', {
      settings: this.settings
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastFrameTime = Date.now();
    this.frameCount = 0;
    
    this.monitorLoop();
    
    logger.debug('PERFORMANCE', 'Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.debug('PERFORMANCE', 'Performance monitoring stopped');
  }

  /**
   * Record frame metrics
   */
  recordFrame(drawCalls: number = 0, particleCount: number = 0, textureMemory: number = 0): void {
    const currentTime = Date.now();
    const frameTime = currentTime - this.lastFrameTime;
    const fps = frameTime > 0 ? 1000 / frameTime : 0;

    const metrics: PerformanceMetrics = {
      fps,
      averageFps: this.calculateAverageFps(),
      frameTime,
      drawCalls,
      particleCount,
      textureMemory,
      timestamp: currentTime
    };

    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    this.lastFrameTime = currentTime;
    this.frameCount++;

    // Notify listeners
    this.performanceCallbacks.forEach(callback => callback(metrics));

    // Check if adaptive adjustments are needed
    if (currentTime - this.lastPerformanceCheck > this.performanceCheckInterval) {
      this.checkAndAdjustPerformance();
      this.lastPerformanceCheck = currentTime;
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get performance statistics over time
   */
  getPerformanceStats(): {
    averageFps: number;
    minFps: number;
    maxFps: number;
    frameDrops: number;
    totalFrames: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageFps: 0,
        minFps: 0,
        maxFps: 0,
        frameDrops: 0,
        totalFrames: 0
      };
    }

    const fpsSamples = this.metrics.map(m => m.fps).filter(fps => fps > 0);
    const averageFps = fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length;
    const minFps = Math.min(...fpsSamples);
    const maxFps = Math.max(...fpsSamples);
    const frameDrops = fpsSamples.filter(fps => fps < this.settings.targetFps * 0.8).length;

    return {
      averageFps: Math.round(averageFps * 10) / 10,
      minFps: Math.round(minFps * 10) / 10,
      maxFps: Math.round(maxFps * 10) / 10,
      frameDrops,
      totalFrames: this.frameCount
    };
  }

  /**
   * Get current performance settings
   */
  getSettings(): PerformanceSettings {
    return { ...this.settings };
  }

  /**
   * Update performance settings
   */
  updateSettings(newSettings: Partial<PerformanceSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    logger.info('PERFORMANCE', 'Settings updated', { settings: this.settings });
  }

  /**
   * Get adaptive adjustments
   */
  getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  /**
   * Check if a feature should be enabled based on performance
   */
  shouldEnableFeature(feature: 'particles' | 'shadows' | 'animations' | 'effects'): boolean {
    switch (feature) {
      case 'particles':
        return this.settings.enableParticles && !this.adaptiveSettings.effectsDisabled;
      case 'shadows':
        return this.settings.enableShadows && this.settings.renderQuality !== 'low';
      case 'animations':
        return this.settings.enableAnimations;
      case 'effects':
        return !this.adaptiveSettings.effectsDisabled;
      default:
        return true;
    }
  }

  /**
   * Get recommended particle count
   */
  getRecommendedParticleCount(): number {
    const baseCount = this.settings.maxParticles;
    const reduction = this.adaptiveSettings.particleReduction;
    return Math.floor(baseCount * (1 - reduction));
  }

  /**
   * Check if animation should be skipped for performance
   */
  shouldSkipAnimation(): boolean {
    return Math.random() < this.adaptiveSettings.animationSkipping;
  }

  /**
   * Get render scale adjustment
   */
  getRenderScale(): number {
    return 1.0 - this.adaptiveSettings.renderScaleReduction;
  }

  /**
   * Subscribe to performance updates
   */
  onPerformanceUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.performanceCallbacks.add(callback);
    return () => this.performanceCallbacks.delete(callback);
  }

  /**
   * Force performance optimization
   */
  optimizeForPerformance(): void {
    this.adaptiveSettings = {
      particleReduction: 0.3,
      animationSkipping: 0.2,
      renderScaleReduction: 0.1,
      effectsDisabled: false
    };

    this.settings.renderQuality = 'medium';
    this.settings.maxParticles = 200;
    
    logger.warn('PERFORMANCE', 'Performance optimization forced', {
      adaptiveSettings: this.adaptiveSettings
    });
  }

  /**
   * Reset performance to high quality
   */
  resetToHighQuality(): void {
    this.adaptiveSettings = {
      particleReduction: 0,
      animationSkipping: 0,
      renderScaleReduction: 0,
      effectsDisabled: false
    };

    this.settings.renderQuality = 'high';
    this.settings.maxParticles = 500;
    
    logger.info('PERFORMANCE', 'Performance reset to high quality');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopMonitoring();
    this.metrics = [];
    this.performanceCallbacks.clear();
    
    logger.info('PERFORMANCE', 'PerformanceManager destroyed');
  }

  // Private methods

  private monitorLoop(): void {
    if (!this.isMonitoring) return;

    // This would typically be called from the render loop
    // For now, we'll simulate monitoring
    setTimeout(() => {
      if (this.isMonitoring) {
        this.monitorLoop();
      }
    }, 16); // ~60fps
  }

  private calculateAverageFps(): number {
    if (this.metrics.length === 0) return 0;

    const recentMetrics = this.metrics.slice(-30); // Last 30 frames
    const fpsSamples = recentMetrics.map(m => m.fps).filter(fps => fps > 0);
    
    if (fpsSamples.length === 0) return 0;
    
    return fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length;
  }

  private checkAndAdjustPerformance(): void {
    const stats = this.getPerformanceStats();
    const targetFps = this.settings.targetFps;
    
    // Performance thresholds
    const criticalFps = targetFps * 0.7; // 42fps if target is 60fps
    const lowFps = targetFps * 0.8; // 48fps if target is 60fps
    const goodFps = targetFps * 0.95; // 57fps if target is 60fps

    logger.debug('PERFORMANCE', 'Performance check', {
      averageFps: stats.averageFps,
      targetFps,
      frameDrops: stats.frameDrops
    });

    if (stats.averageFps < criticalFps) {
      // Critical performance - aggressive optimization
      this.applyAggressiveOptimization();
    } else if (stats.averageFps < lowFps) {
      // Low performance - moderate optimization
      this.applyModerateOptimization();
    } else if (stats.averageFps > goodFps && this.hasActiveOptimizations()) {
      // Good performance - can restore some quality
      this.restoreQuality();
    }
  }

  private applyAggressiveOptimization(): void {
    this.adaptiveSettings.particleReduction = Math.min(0.7, this.adaptiveSettings.particleReduction + 0.2);
    this.adaptiveSettings.animationSkipping = Math.min(0.5, this.adaptiveSettings.animationSkipping + 0.1);
    this.adaptiveSettings.renderScaleReduction = Math.min(0.3, this.adaptiveSettings.renderScaleReduction + 0.1);
    
    if (this.adaptiveSettings.particleReduction > 0.5) {
      this.adaptiveSettings.effectsDisabled = true;
    }

    logger.warn('PERFORMANCE', 'Aggressive optimization applied', {
      adaptiveSettings: this.adaptiveSettings
    });
  }

  private applyModerateOptimization(): void {
    this.adaptiveSettings.particleReduction = Math.min(0.4, this.adaptiveSettings.particleReduction + 0.1);
    this.adaptiveSettings.animationSkipping = Math.min(0.3, this.adaptiveSettings.animationSkipping + 0.05);
    this.adaptiveSettings.renderScaleReduction = Math.min(0.2, this.adaptiveSettings.renderScaleReduction + 0.05);

    logger.info('PERFORMANCE', 'Moderate optimization applied', {
      adaptiveSettings: this.adaptiveSettings
    });
  }

  private restoreQuality(): void {
    this.adaptiveSettings.particleReduction = Math.max(0, this.adaptiveSettings.particleReduction - 0.05);
    this.adaptiveSettings.animationSkipping = Math.max(0, this.adaptiveSettings.animationSkipping - 0.02);
    this.adaptiveSettings.renderScaleReduction = Math.max(0, this.adaptiveSettings.renderScaleReduction - 0.02);
    
    if (this.adaptiveSettings.particleReduction < 0.3) {
      this.adaptiveSettings.effectsDisabled = false;
    }

    logger.debug('PERFORMANCE', 'Quality restored', {
      adaptiveSettings: this.adaptiveSettings
    });
  }

  private hasActiveOptimizations(): boolean {
    return this.adaptiveSettings.particleReduction > 0 ||
           this.adaptiveSettings.animationSkipping > 0 ||
           this.adaptiveSettings.renderScaleReduction > 0 ||
           this.adaptiveSettings.effectsDisabled;
  }

  private detectDeviceCapabilities(): void {
    // Detect device performance capabilities
    // This is a simplified version - in reality, would check:
    // - CPU cores and speed
    // - GPU capabilities
    // - Available RAM
    // - Screen resolution
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isHighEndDevice = !userAgent.includes('mobile') || userAgent.includes('ipad');
    
    if (isHighEndDevice) {
      this.settings.renderQuality = 'high';
      this.settings.maxParticles = 500;
    } else {
      this.settings.renderQuality = 'medium';
      this.settings.maxParticles = 200;
    }

    logger.info('PERFORMANCE', 'Device capabilities detected', {
      isHighEndDevice,
      settings: this.settings
    });
  }
}

// Global performance manager instance
export const performanceManager = new PerformanceManager();