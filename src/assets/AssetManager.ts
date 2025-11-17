/**
 * AssetManager - Phase 3 asset pipeline for sprites and textures
 * Handles loading, caching, and optimization of game assets
 * React Native compatible version with PNG ship assets
 */

import * as PIXI from 'pixi.js';
import { ShipType, PlayerColor } from '../game/core/Types';
import { logger } from '../utils/Logger';

// Import ship assets
// Blue ships
const BlueArtillery = require('./ships/Blue Artillery.png');
const BlueBattleship = require('./ships/Blue Battleship.png');
const BlueCaptain = require('./ships/Blue Captain.png');
const BlueCorvette = require('./ships/Blue Corvette.png');
const BlueCruiser = require('./ships/Blue Cruiser.png');
const BlueDestroyer = require('./ships/Blue Destroyer.png');
const BlueInterceptor = require('./ships/Blue Interceptor.png');
const BlueScout = require('./ships/Blue Scout.png');

// Green ships
const GreenArtillery = require('./ships/Green Artillery.png');
const GreenBattleship = require('./ships/Green Battleship.png');
const GreenCaptain = require('./ships/Green Captain.png');
const GreenCorvette = require('./ships/Green Corvette.png');
const GreenCruiser = require('./ships/Green Cruiser.png');
const GreenDestroyer = require('./ships/Green Destroyer.png');
const GreenInterceptor = require('./ships/Green Interceptor.png');
const GreenScout = require('./ships/Green Scout.png');

// Red ships
const RedArtillery = require('./ships/Red Artillery.png');
const RedBattleship = require('./ships/Red Battleship.png');
const RedCommander = require('./ships/Red Commander.png');
const RedCorvette = require('./ships/Red Corvette.png');
const RedCruiser = require('./ships/Red Cruiser.png');
const RedDestroyer = require('./ships/Red Destroyer.png');
const RedInterceptor = require('./ships/Red Interceptor.png');
const RedScout = require('./ships/Red Scout.png');

// Yellow ships
const YellowArtillery = require('./ships/Yellow Artillery.png');
const YellowBattleship = require('./ships/Yellow Battleship.png');
const YellowCaptain = require('./ships/Yellow Captain.png');
const YellowCorvette = require('./ships/Yellow Corvette.png');
const YellowCruiser = require('./ships/Yellow Cruiser.png');
const YellowDestroyer = require('./ships/Yellow Destroyer.png');
const YellowInterceptor = require('./ships/Yellow Interceptor.png');
const YellowScout = require('./ships/Yellow Scout.png');

// Asset mapping for ship sprites
const SHIP_ASSET_MAP: Record<string, any> = {
  // Blue ships
  'BLUE_ARTILLERY': BlueArtillery,
  'BLUE_CAPTAIN': BlueBattleship, // Battleship maps to Captain
  'BLUE_FLEET_ADMIRAL': BlueCruiser, // Cruiser maps to Fleet Admiral
  'BLUE_CORVETTE': BlueCorvette,
  'BLUE_DESTROYER': BlueDestroyer,
  'BLUE_INTERCEPTOR': BlueInterceptor,
  'BLUE_SCOUT': BlueScout,

  // Green ships
  'GREEN_ARTILLERY': GreenArtillery,
  'GREEN_CAPTAIN': GreenBattleship,
  'GREEN_FLEET_ADMIRAL': GreenCruiser,
  'GREEN_CORVETTE': GreenCorvette,
  'GREEN_DESTROYER': GreenDestroyer,
  'GREEN_INTERCEPTOR': GreenInterceptor,
  'GREEN_SCOUT': GreenScout,

  // Red ships
  'RED_ARTILLERY': RedArtillery,
  'RED_CAPTAIN': RedBattleship,
  'RED_FLEET_ADMIRAL': RedCruiser,
  'RED_CORVETTE': RedCorvette,
  'RED_DESTROYER': RedDestroyer,
  'RED_INTERCEPTOR': RedInterceptor,
  'RED_SCOUT': RedScout,

  // Yellow ships
  'YELLOW_ARTILLERY': YellowArtillery,
  'YELLOW_CAPTAIN': YellowBattleship,
  'YELLOW_FLEET_ADMIRAL': YellowCruiser,
  'YELLOW_CORVETTE': YellowCorvette,
  'YELLOW_DESTROYER': YellowDestroyer,
  'YELLOW_INTERCEPTOR': YellowInterceptor,
  'YELLOW_SCOUT': YellowScout
};

interface AssetDefinition {
  id: string;
  type: 'texture' | 'sprite' | 'audio';
  path: string;
  preload: boolean;
  fallback?: string;
}

interface LoadedAsset {
  id: string;
  asset: PIXI.Texture | HTMLAudioElement | any;
  isLoaded: boolean;
  loadTime: number;
  size: number;
}

interface AssetManifest {
  ships: Record<string, AssetDefinition>;
  effects: Record<string, AssetDefinition>;
  terrain: Record<string, AssetDefinition>;
  sounds: Record<string, AssetDefinition>;
  ui: Record<string, AssetDefinition>;
}

export class AssetManager {
  private assets: Map<string, LoadedAsset> = new Map();
  private loadingPromises: Map<string, Promise<LoadedAsset>> = new Map();
  private manifest: AssetManifest;
  private totalLoadTime: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.manifest = this.createAssetManifest();
  }

  /**
   * Initialize the asset manager
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Load essential assets first
      await this.loadEssentialAssets();
      
      this.totalLoadTime = Date.now() - startTime;
      this.isInitialized = true;
      
      logger.info('ASSETS', 'AssetManager initialized', {
        loadTime: this.totalLoadTime,
        assetsLoaded: this.assets.size
      });
    } catch (error) {
      logger.error('ASSETS', 'Failed to initialize AssetManager', error);
      throw error;
    }
  }

  /**
   * Get ship texture for specific color and type
   */
  getShipTexture(playerColor: PlayerColor, shipType: ShipType): PIXI.Texture | null {
    const assetKey = `${playerColor}_${shipType}`;
    const assetSource = SHIP_ASSET_MAP[assetKey];
    
    if (assetSource) {
      try {
        // Create PIXI texture from the asset source
        return PIXI.Texture.from(assetSource);
      } catch (error) {
        logger.warn('ASSETS', 'Failed to create texture from asset', { assetKey, error });
      }
    }
    
    // Fallback to cached asset or placeholder
    const assetId = `ship_${playerColor}_${shipType}`;
    return this.getAsset(assetId) as PIXI.Texture || this.createFallbackTexture();
  }

  /**
   * Get terrain texture
   */
  getTerrainTexture(terrainType: string): PIXI.Texture | null {
    const assetId = `terrain_${terrainType}`;
    return this.getAsset(assetId) as PIXI.Texture || null;
  }

  /**
   * Get effect texture
   */
  getEffectTexture(effectType: string): PIXI.Texture | null {
    const assetId = `effect_${effectType}`;
    return this.getAsset(assetId) as PIXI.Texture || null;
  }

  /**
   * Get UI texture
   */
  getUITexture(uiElement: string): PIXI.Texture | null {
    const assetId = `ui_${uiElement}`;
    return this.getAsset(assetId) as PIXI.Texture || null;
  }

  /**
   * Get ship asset path for spritesheet preparation
   */
  getShipAssetPath(playerColor: PlayerColor, shipType: ShipType): any {
    const assetKey = `${playerColor}_${shipType}`;
    return SHIP_ASSET_MAP[assetKey];
  }

  /**
   * Preload all ship textures
   */
  async preloadShipTextures(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    Object.values(PlayerColor).forEach(color => {
      Object.values(ShipType).forEach(shipType => {
        const promise = new Promise<void>((resolve) => {
          try {
            this.getShipTexture(color, shipType);
            resolve();
          } catch (error) {
            logger.warn('ASSETS', 'Failed to preload ship texture', { color, shipType, error });
            resolve();
          }
        });
        loadPromises.push(promise);
      });
    });

    await Promise.all(loadPromises);
    logger.info('ASSETS', 'Ship textures preloaded');
  }

  /**
   * Load asset by ID
   */
  async loadAsset(assetId: string): Promise<LoadedAsset | null> {
    // Check if already loaded
    if (this.assets.has(assetId)) {
      return this.assets.get(assetId)!;
    }

    // Check if currently loading
    if (this.loadingPromises.has(assetId)) {
      return await this.loadingPromises.get(assetId)!;
    }

    // Find asset definition
    const assetDef = this.findAssetDefinition(assetId);
    if (!assetDef) {
      logger.warn('ASSETS', 'Asset definition not found', { assetId });
      return null;
    }

    // Start loading
    const loadPromise = this.loadAssetData(assetDef);
    this.loadingPromises.set(assetId, loadPromise);

    try {
      const loadedAsset = await loadPromise;
      this.assets.set(assetId, loadedAsset);
      this.loadingPromises.delete(assetId);
      
      logger.debug('ASSETS', 'Asset loaded', { 
        assetId, 
        loadTime: loadedAsset.loadTime,
        size: loadedAsset.size 
      });
      
      return loadedAsset;
    } catch (error) {
      this.loadingPromises.delete(assetId);
      logger.error('ASSETS', 'Failed to load asset', { assetId, error });
      
      // Try fallback
      if (assetDef.fallback) {
        return await this.loadAsset(assetDef.fallback);
      }
      
      return null;
    }
  }

  /**
   * Preload assets for better performance
   */
  async preloadAssets(assetIds: string[]): Promise<void> {
    const loadPromises = assetIds.map(assetId => this.loadAsset(assetId));
    await Promise.all(loadPromises);
    
    logger.info('ASSETS', 'Assets preloaded', { count: assetIds.length });
  }

  /**
   * Unload asset to free memory
   */
  unloadAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (asset) {
      // Destroy PIXI textures
      if (asset.asset instanceof PIXI.Texture) {
        asset.asset.destroy();
      }
      
      this.assets.delete(assetId);
      logger.debug('ASSETS', 'Asset unloaded', { assetId });
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    totalAssets: number;
    totalMemory: number;
    textureMemory: number;
    audioMemory: number;
  } {
    let totalMemory = 0;
    let textureMemory = 0;
    let audioMemory = 0;

    this.assets.forEach(asset => {
      totalMemory += asset.size;
      
      if (asset.asset instanceof PIXI.Texture) {
        textureMemory += asset.size;
      } else if (asset.asset instanceof HTMLAudioElement) {
        audioMemory += asset.size;
      }
    });

    return {
      totalAssets: this.assets.size,
      totalMemory,
      textureMemory,
      audioMemory
    };
  }

  /**
   * Create fallback textures for missing assets
   */
  createFallbackTexture(width: number = 64, height: number = 64, color: number = 0xff00ff): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(color);
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();
    
    const texture = PIXI.RenderTexture.create({ width, height });
    const renderer = new PIXI.Renderer({ width, height });
    renderer.render(graphics, { renderTexture: texture });
    
    return texture;
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    // Unload all assets
    this.assets.forEach((asset, assetId) => {
      this.unloadAsset(assetId);
    });
    
    this.assets.clear();
    this.loadingPromises.clear();
    
    logger.info('ASSETS', 'AssetManager destroyed');
  }

  // Private methods

  private getAsset(assetId: string): any {
    const asset = this.assets.get(assetId);
    return asset ? asset.asset : null;
  }

  private async loadEssentialAssets(): Promise<void> {
    const essentialAssets: string[] = [];
    
    // Add essential ship sprites
    Object.values(PlayerColor).forEach(color => {
      Object.values(ShipType).forEach(shipType => {
        const assetId = `ship_${color}_${shipType}`;
        essentialAssets.push(assetId);
      });
    });
    
    // Add essential UI elements
    essentialAssets.push('ui_hex_highlight', 'ui_selection_ring');
    
    // Load placeholder assets (in real app would load from files)
    for (const assetId of essentialAssets) {
      const placeholderAsset: LoadedAsset = {
        id: assetId,
        asset: this.createPlaceholderTexture(assetId),
        isLoaded: true,
        loadTime: 0,
        size: 4096 // Estimated size
      };
      
      this.assets.set(assetId, placeholderAsset);
    }
  }

  private createPlaceholderTexture(assetId: string): PIXI.Texture {
    // Create different placeholder textures based on asset type
    if (assetId.includes('ship_')) {
      return this.createShipPlaceholder(assetId);
    } else if (assetId.includes('terrain_')) {
      return this.createTerrainPlaceholder(assetId);
    } else if (assetId.includes('effect_')) {
      return this.createEffectPlaceholder(assetId);
    } else {
      return this.createFallbackTexture();
    }
  }

  private createShipPlaceholder(assetId: string): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    
    // Extract color and ship type from asset ID
    const parts = assetId.split('_');
    const colorName = parts[1];
    const shipTypeName = parts[2];
    
    const color = this.getColorFromName(colorName);
    const size = this.getSizeFromShipType(shipTypeName);
    
    // Draw ship shape
    graphics.beginFill(color);
    graphics.drawPolygon([
      -size, 0,
      0, -size * 0.8,
      size, 0,
      0, size * 0.8
    ]);
    graphics.endFill();
    
    // Add border
    graphics.lineStyle(2, 0xffffff, 0.8);
    graphics.drawCircle(0, 0, size + 2);

    return PIXI.RenderTexture.create({ width: size * 3, height: size * 3 });
  }

  private createTerrainPlaceholder(assetId: string): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    const size = 64;
    
    // Different colors for different terrain types
    const terrainColors: Record<string, number> = {
      plains: 0x1a1a1a,
      asteroid: 0x666666,
      nebula: 0x441166,
      station: 0x004466,
      debris: 0x442222
    };
    
    const terrainType = assetId.split('_')[1];
    const color = terrainColors[terrainType] || 0x333333;
    
    graphics.beginFill(color);
    graphics.drawRect(0, 0, size, size);
    graphics.endFill();
    
    return PIXI.RenderTexture.create({ width: size, height: size });
  }

  private createEffectPlaceholder(assetId: string): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    const size = 32;
    
    // Bright colors for effects
    graphics.beginFill(0xffaa00);
    graphics.drawCircle(size/2, size/2, size/2);
    graphics.endFill();
    
    return PIXI.RenderTexture.create({ width: size, height: size });
  }

  private getColorFromName(colorName: string): number {
    const colors: Record<string, number> = {
      BLUE: 0x4A90E2,
      RED: 0xD0021B,
      GREEN: 0x7ED321,
      YELLOW: 0xF8E71C
    };
    return colors[colorName.toUpperCase()] || 0x888888;
  }

  private getSizeFromShipType(shipType: string): number {
    const sizes: Record<string, number> = {
      FLEET_ADMIRAL: 20,
      CAPTAIN: 18,
      DESTROYER: 16,
      ARTILLERY: 15,
      INTERCEPTOR: 12,
      CORVETTE: 12,
      SCOUT: 10
    };
    return sizes[shipType.toUpperCase()] || 14;
  }

  private findAssetDefinition(assetId: string): AssetDefinition | null {
    // Check each category in manifest
    for (const category of Object.values(this.manifest)) {
      if (category[assetId]) {
        return category[assetId];
      }
    }
    return null;
  }

  private async loadAssetData(assetDef: AssetDefinition): Promise<LoadedAsset> {
    const startTime = Date.now();
    
    try {
      let asset: any;
      
      switch (assetDef.type) {
        case 'texture':
        case 'sprite':
          // In real app: asset = await PIXI.Texture.fromURL(assetDef.path);
          asset = this.createPlaceholderTexture(assetDef.id);
          break;
          
        case 'audio':
          // In real app: asset = new Audio(assetDef.path);
          asset = null; // Placeholder
          break;
          
        default:
          throw new Error(`Unsupported asset type: ${assetDef.type}`);
      }
      
      return {
        id: assetDef.id,
        asset,
        isLoaded: true,
        loadTime: Date.now() - startTime,
        size: 4096 // Estimated size
      };
    } catch (error) {
      logger.error('ASSETS', 'Failed to load asset data', { assetDef, error });
      throw error;
    }
  }

  private createAssetManifest(): AssetManifest {
    const manifest: AssetManifest = {
      ships: {},
      effects: {},
      terrain: {},
      sounds: {},
      ui: {}
    };
    
    // Generate ship asset definitions
    Object.values(PlayerColor).forEach(color => {
      Object.values(ShipType).forEach(shipType => {
        const assetId = `ship_${color}_${shipType}`;
        manifest.ships[assetId] = {
          id: assetId,
          type: 'sprite',
          path: `assets/ships/${color}_${shipType}.png`,
          preload: true,
          fallback: 'ship_placeholder'
        };
      });
    });
    
    // Add other asset definitions
    manifest.ui['ui_hex_highlight'] = {
      id: 'ui_hex_highlight',
      type: 'texture',
      path: 'assets/ui/hex_highlight.png',
      preload: true
    };
    
    return manifest;
  }
}

// Global asset manager instance
export const assetManager = new AssetManager();