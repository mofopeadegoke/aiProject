"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Camera, Upload, X, Loader2, CheckCircle2, AlertCircle, Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

type InputMode = "webcam" | "upload" | "ngrok" | null
type ProcessingState = "idle" | "processing" | "success" | "error"

export default function ImageAnalyzerPage() {
  const [mode, setMode] = useState<InputMode>(null)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processingState, setProcessingState] = useState<ProcessingState>("idle")
  const [apiResult, setApiResult] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<string | null>(null)
  const [ngrokUrl, setNgrokUrl] = useState<string>("")
  const [isNgrokStreaming, setIsNgrokStreaming] = useState(false)
  const [isContinuousInference, setIsContinuousInference] = useState(false)
  const [inferenceResults, setInferenceResults] = useState<string[]>([])
  const [inferenceInterval, setInferenceInterval] = useState<number>(2000)
  const [ngrokImageLoaded, setNgrokImageLoaded] = useState(false)
  const [ngrokImageKey, setNgrokImageKey] = useState(0)
  const [useIframe, setUseIframe] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const ngrokImgRef = useRef<HTMLImageElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const inferenceIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { toast } = useToast()

  useEffect(() => {
    return () => {
      stopWebcam()
      stopContinuousInference()
    }
  }, [])

  const startWebcam = async () => {
    try {
      console.log("[v0] Requesting webcam access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      })

      console.log("[v0] Webcam access granted, stream obtained:", stream)
      streamRef.current = stream

      setMode("webcam")
      setIsWebcamActive(true)
      setCapturedImage(null)

      // Wait for next tick to ensure state is updated
      setTimeout(() => {
        if (videoRef.current) {
          console.log("[v0] Setting video srcObject and playing...")
          videoRef.current.srcObject = stream
          
          // Try to play immediately
          videoRef.current.play().catch((playError) => {
            console.error("[v0] Play error:", playError)
          })
          
          console.log("[v0] Video setup complete")
        }
      }, 100)

      toast({
        title: "Webcam activated",
        description: "Your webcam is now streaming",
      })
    } catch (error) {
      console.error("[v0] Webcam error:", error)
      toast({
        title: "Webcam access denied",
        description: "Please allow webcam access to use this feature",
        variant: "destructive",
      })
    }
  }

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.match(/^video\/(mp4|webm|ogg)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an MP4, WebM, or OGG video",
        variant: "destructive",
      })
      return
    }

    const videoUrl = URL.createObjectURL(file)
    setVideoFile(videoUrl)
    setMode("webcam")
    setIsWebcamActive(true)
    setCapturedImage(null)

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = videoUrl
        videoRef.current.load()
      }
    }, 0)

    toast({
      title: "Video loaded",
      description: "Your video is ready to play",
    })
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.src = ""
      videoRef.current.load()
    }

    if (videoFile) {
      URL.revokeObjectURL(videoFile)
      setVideoFile(null)
    }

    setIsWebcamActive(false)
    setIsNgrokStreaming(false)
    stopContinuousInference()
  }

  const captureImageFromStream = (): string | null => {
    if (mode === "ngrok") {
      if (useIframe) {
        // For iframe mode, we can't capture directly - user needs to use screenshot
        toast({
          title: "Iframe mode active",
          description: "Please use your browser's screenshot tool or switch to image endpoint",
          variant: "destructive",
        })
        return null
      }
      
      const canvas = canvasRef.current
      const img = ngrokImgRef.current
      
      if (!canvas || !img) return null

      // Check if image is loaded and not broken
      if (!img.complete || img.naturalWidth === 0) {
        console.warn("[v0] Image not loaded yet or is broken")
        return null
      }

      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height

      const ctx = canvas.getContext("2d")
      if (ctx) {
        try {
          ctx.drawImage(img, 0, 0)
          return canvas.toDataURL("image/jpeg", 0.9)
        } catch (error) {
          console.error("[v0] Error drawing image to canvas:", error)
          return null
        }
      }
      return null
    }

    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("[v0] Video not ready yet")
      return null
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")
    if (ctx) {
      try {
        ctx.drawImage(video, 0, 0)
        return canvas.toDataURL("image/jpeg", 0.9)
      } catch (error) {
        console.error("[v0] Error drawing video to canvas:", error)
        return null
      }
    }
    return null
  }

  const captureImage = () => {
    const imageData = captureImageFromStream()
    if (imageData) {
      setCapturedImage(imageData)
      stopWebcam()

      toast({
        title: "Image captured",
        description: "You can now analyze this image",
      })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, or GIF image",
        variant: "destructive",
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setUploadedImage(result)
      setMode("upload")

      toast({
        title: "Image uploaded",
        description: "You can now analyze this image",
      })
    }
    reader.readAsDataURL(file)
  }

  const analyzeImage = async (imageData?: string) => {
    const imageToAnalyze = imageData || capturedImage || uploadedImage

    if (!imageToAnalyze) {
      toast({
        title: "No image selected",
        description: "Please capture or upload an image first",
        variant: "destructive",
      })
      return
    }

    setProcessingState("processing")
    if (!isContinuousInference) {
      setApiResult(null)
    }

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageToAnalyze }),
      })

      if (!response.ok) {
        throw new Error("API request failed")
      }

      const data = await response.json()
      const result = data.result || "Analysis completed successfully"

      setApiResult(result)
      setProcessingState("success")

      // Add to inference history if continuous
      if (isContinuousInference) {
        setInferenceResults((prev) => {
          const newResults = [result, ...prev].slice(0, 10) // Keep last 10 results
          return newResults
        })
      }

      if (!isContinuousInference) {
        toast({
          title: "Analysis complete",
          description: "Your image has been analyzed successfully",
        })
      }
    } catch (error) {
      console.error("[v0] API error:", error)
      setProcessingState("error")
      setApiResult("Failed to analyze image. Please try again.")

      if (!isContinuousInference) {
        toast({
          title: "Analysis failed",
          description: "There was an error processing your image",
          variant: "destructive",
        })
      }
    }
  }

  const startContinuousInference = () => {
    if (inferenceIntervalRef.current) return

    // Check if ngrok image is loaded before starting
    if (mode === "ngrok" && !ngrokImageLoaded) {
      toast({
        title: "Waiting for stream",
        description: "Please wait for the ngrok stream to load first",
        variant: "destructive",
      })
      return
    }

    setIsContinuousInference(true)
    setInferenceResults([])

    toast({
      title: "Continuous inference started",
      description: `Analyzing every ${inferenceInterval / 1000} seconds`,
    })

    // Run first inference after a short delay
    setTimeout(() => {
      const imageData = captureImageFromStream()
      if (imageData) {
        analyzeImage(imageData)
      }
    }, 100)

    // Set up interval for continuous inference
    inferenceIntervalRef.current = setInterval(() => {
      // For ngrok, refresh the image before capturing
      if (mode === "ngrok") {
        setNgrokImageKey(prev => prev + 1)
        // Wait a bit for the new image to load
        setTimeout(() => {
          const imageData = captureImageFromStream()
          if (imageData) {
            analyzeImage(imageData)
          }
        }, 200)
      } else {
        const imageData = captureImageFromStream()
        if (imageData) {
          analyzeImage(imageData)
        }
      }
    }, inferenceInterval)
  }

  const stopContinuousInference = () => {
    if (inferenceIntervalRef.current) {
      clearInterval(inferenceIntervalRef.current)
      inferenceIntervalRef.current = null
    }
    setIsContinuousInference(false)
  }

  const toggleContinuousInference = () => {
    if (isContinuousInference) {
      stopContinuousInference()
      toast({
        title: "Continuous inference stopped",
        description: "Manual analysis only",
      })
    } else {
      startContinuousInference()
    }
  }

  const reset = () => {
    stopWebcam()
    setMode(null)
    setCapturedImage(null)
    setUploadedImage(null)
    setProcessingState("idle")
    setApiResult(null)
    setNgrokUrl("")
    setInferenceResults([])

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (videoInputRef.current) {
      videoInputRef.current.value = ""
    }
  }

  const startNgrokStream = () => {
    if (!ngrokUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter your ngrok URL",
        variant: "destructive",
      })
      return
    }

    setMode("ngrok")
    setIsNgrokStreaming(true)
    setCapturedImage(null)
    setNgrokImageLoaded(false)
    setNgrokImageKey(0)

    toast({
      title: "Ngrok stream starting",
      description: "Loading stream from your model...",
    })
  }

  const currentImage = capturedImage || uploadedImage

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-balance">Eco Wheels</h1>
              <p className="mt-2 text-sm text-muted-foreground">Capture or upload images for intelligent analysis</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {(isWebcamActive || isNgrokStreaming) ? (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="relative bg-black flex items-center justify-center" style={{ minHeight: "70vh" }}>
                {mode === "ngrok" ? (
                  useIframe ? (
                    <iframe
                      src={ngrokUrl}
                      className="w-full h-full min-h-[70vh] border-0"
                      title="Ngrok stream"
                      onLoad={() => {
                        setNgrokImageLoaded(true)
                        toast({
                          title: "Stream loaded",
                          description: "Iframe stream is ready (capture not available in this mode)",
                        })
                      }}
                    />
                  ) : (
                    <img
                      ref={ngrokImgRef}
                      src={`${ngrokUrl}${ngrokUrl.includes('?') ? '&' : '?'}t=${Date.now()}&key=${ngrokImageKey}`}
                      alt="Ngrok video stream"
                      className="max-h-[70vh] w-full object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error("[v0] Failed to load ngrok image")
                        setNgrokImageLoaded(false)
                        toast({
                          title: "Image load failed",
                          description: "Your endpoint may be returning HTML. Try enabling 'Iframe Mode' below.",
                          variant: "destructive",
                        })
                      }}
                      onLoad={() => {
                        console.log("[v0] Ngrok image loaded successfully")
                        setNgrokImageLoaded(true)
                        if (!isContinuousInference) {
                          toast({
                            title: "Stream ready",
                            description: "You can now start continuous inference",
                          })
                        }
                      }}
                    />
                  )
                ) : (
                  <video
                    ref={videoRef}
                    className="max-h-[70vh] w-full object-contain"
                    autoPlay
                    playsInline
                    muted
                    aria-label="Webcam stream"
                  />
                )}
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Live inference overlay */}
                {isContinuousInference && apiResult && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-semibold">LIVE INFERENCE</span>
                    </div>
                    <p className="text-sm">{apiResult}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 p-4">
                <Button 
                  onClick={toggleContinuousInference} 
                  size="lg" 
                  className="flex-1"
                  variant={isContinuousInference ? "destructive" : "default"}
                  disabled={mode === "ngrok" && !ngrokImageLoaded}
                  aria-label="Toggle continuous inference"
                >
                  {isContinuousInference ? (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      Stop Continuous
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      {mode === "ngrok" && !ngrokImageLoaded ? "Loading..." : "Start Continuous"}
                    </>
                  )}
                </Button>
                <Button 
                  onClick={captureImage} 
                  size="lg" 
                  disabled={isContinuousInference}
                  aria-label="Capture single frame"
                >
                  <Camera className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" onClick={stopWebcam} aria-label="Stop video">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Inference interval control */}
              <div className="px-4 pb-4">
                <label htmlFor="inference-interval" className="block text-sm font-medium mb-2">
                  Inference Interval: {inferenceInterval / 1000}s
                </label>
                <input
                  id="inference-interval"
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={inferenceInterval}
                  onChange={(e) => setInferenceInterval(Number(e.target.value))}
                  disabled={isContinuousInference}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5s</span>
                  <span>5s</span>
                </div>
              </div>
            </Card>

            {/* Inference History */}
            {isContinuousInference && inferenceResults.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Recent Inferences</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {inferenceResults.map((result, index) => (
                    <div key={index} className="text-sm p-2 bg-muted rounded">
                      <span className="text-xs text-muted-foreground mr-2">#{inferenceResults.length - index}</span>
                      {result}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Input Section */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-6">Select Input Method</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Button
                    size="lg"
                    variant={mode === "webcam" ? "default" : "outline"}
                    className="h-auto flex-col gap-3 py-8"
                    onClick={startWebcam}
                    disabled={isWebcamActive}
                    aria-label="Start webcam stream"
                  >
                    <Camera className="h-8 w-8" />
                    <div className="text-center">
                      <div className="font-semibold">Webcam</div>
                      <div className="text-xs text-muted-foreground mt-1">Live stream</div>
                    </div>
                  </Button>

                  <Button
                    size="lg"
                    variant={mode === "upload" ? "default" : "outline"}
                    className="h-auto flex-col gap-3 py-8"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload image from device"
                  >
                    <Upload className="h-8 w-8" />
                    <div className="text-center">
                      <div className="font-semibold">Upload</div>
                      <div className="text-xs text-muted-foreground mt-1">JPEG, PNG, GIF</div>
                    </div>
                  </Button>
                </div>

                <div className="mt-6">
                  <label htmlFor="ngrok-url" className="block text-sm font-medium mb-2">
                    Or stream from Ngrok URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="ngrok-url"
                      type="text"
                      value={ngrokUrl}
                      onChange={(e) => setNgrokUrl(e.target.value)}
                      placeholder="https://abc123.ngrok-free.app/video"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button
                      onClick={startNgrokStream}
                      disabled={isNgrokStreaming || !ngrokUrl.trim()}
                      className="shrink-0"
                    >
                      Start
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="iframe-mode"
                      checked={useIframe}
                      onChange={(e) => setUseIframe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="iframe-mode" className="text-xs text-muted-foreground">
                      Use Iframe Mode (for HTML endpoints - disables capture)
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter your ngrok URL. If it returns an image, leave iframe mode off. If it returns HTML with a video player, enable iframe mode.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFileUpload}
                  className="sr-only"
                  aria-label="File upload input"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={handleVideoUpload}
                  className="sr-only"
                  aria-label="Video file upload input"
                />
              </Card>

              {/* Image Preview */}
              {currentImage && !isWebcamActive && (
                <Card className="overflow-hidden">
                  <div className="relative aspect-video bg-muted">
                    <img
                      src={currentImage || "/placeholder.svg"}
                      alt="Selected image for analysis"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2 p-4">
                    <Button
                      onClick={() => analyzeImage()}
                      disabled={processingState === "processing"}
                      className="flex-1"
                      aria-label="Analyze selected image"
                    >
                      {processingState === "processing" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze Image"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={reset}
                      disabled={processingState === "processing"}
                      aria-label="Clear and start over"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            {/* Results Section */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-6">Analysis Results</h2>

                {processingState === "idle" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-muted p-6 mb-4">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Select an input method and analyze an image to see results here
                    </p>
                  </div>
                )}

                {processingState === "processing" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-sm font-medium">Processing your image...</p>
                    <p className="text-xs text-muted-foreground mt-2">This may take a few moments</p>
                  </div>
                )}

                {processingState === "success" && apiResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Success</span>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm leading-relaxed">{apiResult}</p>
                    </div>
                  </div>
                )}

                {processingState === "error" && apiResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Error</span>
                    </div>
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                      <p className="text-sm leading-relaxed text-destructive">{apiResult}</p>
                    </div>
                    <Button variant="outline" onClick={() => analyzeImage()} className="w-full bg-transparent">
                      Retry Analysis
                    </Button>
                  </div>
                )}
              </Card>

              {/* Instructions */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">How to Use</h3>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      1
                    </span>
                    <span className="leading-relaxed">
                      Choose webcam, upload an image, or connect to an ngrok stream
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      2
                    </span>
                    <span className="leading-relaxed">
                      For live streams, click "Start Continuous" to run inference automatically at set intervals
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Adjust the inference interval slider (0.5s - 5s) to control how often analysis runs
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      4
                    </span>
                    <span className="leading-relaxed">
                      View real-time results as overlay on the stream and check recent inference history
                    </span>
                  </li>
                </ol>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Toaster />
    </div>
  )
}