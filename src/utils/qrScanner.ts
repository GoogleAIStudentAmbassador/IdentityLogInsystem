/**
 * OOP & Extensible Craft Protocol 準拠の QR スキャナーエンジン
 * Strategy パターンにより、ブラウザ標準 BarcodeDetector と jsQR を透過的に切り替えます。
 */

import jsQR from 'jsqr';

export interface QrScanResult {
  data: string;
  timestamp: number;
}

export interface IQrDecoderStrategy {
  readonly name: string;
  isSupported(): boolean;
  decode(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number): Promise<string | null>;
}

/**
 * 1. モダンブラウザ標準の BarcodeDetector Strategy（ハードウェアアクセラレーション活用）
 */
export class NativeBarcodeDetectorStrategy implements IQrDecoderStrategy {
  public readonly name = 'BarcodeDetector';
  private detector: unknown = null;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  public async decode(canvas: HTMLCanvasElement): Promise<string | null> {
    if (!this.isSupported()) return null;

    try {
      if (!this.detector) {
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        this.detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      }

      const results = await (this.detector as { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }).detect(canvas);
      if (results && results.length > 0 && results[0].rawValue) {
        return results[0].rawValue;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * 2. jsQR Strategy（Canvas ピクセル解析・ユニバーサルフォールバック）
 */
export class JsQrStrategy implements IQrDecoderStrategy {
  public readonly name = 'jsQR';

  public isSupported(): boolean {
    return typeof jsQR === 'function';
  }

  public async decode(
    _canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): Promise<string | null> {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      return code ? code.data : null;
    } catch {
      return null;
    }
  }
}

/**
 * QR スキャナーエンジン（ライフサイクルとカメラストリーム統括）
 */
export class QrScannerEngine {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isScanning = false;
  private strategies: IQrDecoderStrategy[];
  private activeStrategy: IQrDecoderStrategy;
  private onResultCallback: ((result: QrScanResult) => void) | null = null;
  private lastScannedData = '';
  private lastScannedTime = 0;
  private debounceMs = 1200; // 同一QRの再検知クールダウン時間
  private lastScanProcessTime = 0; // デコード処理スロットリング用
  private scanIntervalMs = 180; // 最大秒5〜6回の解析に制限して熱暴走・クラッシュを根絶

  constructor(customStrategies?: IQrDecoderStrategy[]) {
    const native = new NativeBarcodeDetectorStrategy();
    const fallback = new JsQrStrategy();

    this.strategies = customStrategies || [native, fallback];
    this.activeStrategy = this.strategies.find((s) => s.isSupported()) || fallback;
  }

  public getActiveStrategyName(): string {
    return this.activeStrategy.name;
  }

  public isRunning(): boolean {
    return this.isScanning;
  }

  public setDebounceMs(ms: number): void {
    this.debounceMs = ms;
  }

  /**
   * カメラの起動とストリーム初期化
   */
  public async start(
    video: HTMLVideoElement,
    onResult: (result: QrScanResult) => void,
    facingMode: 'environment' | 'user' = 'environment'
  ): Promise<void> {
    this.videoElement = video;
    this.onResultCallback = onResult;
    this.canvasElement = document.createElement('canvas');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('お使いのブラウザはカメラアクセスをサポートしていません。');
    }

    // 既存ストリームがあれば停止
    this.stop();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      this.videoElement.setAttribute('playsinline', 'true'); // iOS Safari でインライン再生必須

      await this.videoElement.play();
      this.isScanning = true;
      this.lastScannedData = '';
      this.lastScannedTime = 0;
      this.lastScanProcessTime = 0;

      this.scanLoop();
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  /**
   * スキャンの停止とカメラリソース解放
   */
  public stop(): void {
    this.isScanning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * クールダウンをリセット（手動で即座に次のスキャンを許可する場合）
   */
  public resetCooldown(): void {
    this.lastScannedData = '';
    this.lastScannedTime = 0;
  }

  private scanLoop = async (): Promise<void> => {
    if (!this.isScanning || !this.videoElement || !this.canvasElement) return;

    const now = Date.now();
    // 最小スキャン間隔（180ms）を満たしている場合のみ画像抽出・デコードを実行
    if (
      this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA &&
      now - this.lastScanProcessTime >= this.scanIntervalMs
    ) {
      this.lastScanProcessTime = now;
      const videoWidth = this.videoElement.videoWidth;
      const videoHeight = this.videoElement.videoHeight;

      if (videoWidth > 0 && videoHeight > 0) {
        // 解像度を最大 640px にスケーリング（iOS/モバイルのメモリ消費・CPU過熱を根本防止）
        const maxDim = 640;
        let targetWidth = videoWidth;
        let targetHeight = videoHeight;
        if (videoWidth > maxDim || videoHeight > maxDim) {
          const scale = Math.min(maxDim / videoWidth, maxDim / videoHeight);
          targetWidth = Math.round(videoWidth * scale);
          targetHeight = Math.round(videoHeight * scale);
        }

        this.canvasElement.width = targetWidth;
        this.canvasElement.height = targetHeight;
        const ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(this.videoElement, 0, 0, targetWidth, targetHeight);

          const decoded = await this.activeStrategy.decode(
            this.canvasElement,
            ctx,
            targetWidth,
            targetHeight
          );

          if (decoded && this.isScanning) {
            const isDifferent = decoded !== this.lastScannedData;
            const isCooldownExpired = now - this.lastScannedTime > this.debounceMs;

            if (isDifferent || isCooldownExpired) {
              this.lastScannedData = decoded;
              this.lastScannedTime = now;

              if (this.onResultCallback) {
                this.onResultCallback({
                  data: decoded,
                  timestamp: now,
                });
              }
            }
          }
        }
      }
    }

    if (this.isScanning) {
      this.animationFrameId = requestAnimationFrame(this.scanLoop);
    }
  };
}
