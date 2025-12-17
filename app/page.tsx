"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Camera, Upload, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

type InputMode = "webcam" | "upload" | null
type ProcessingState = "idle" | "processing" | "success" | "error"

export default function ImageAnalyzerPage() {
  const [mode, setMode] = useState<InputMode>(null)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processingState, setProcessingState] = useState<ProcessingState>("idle")
  const [apiResult, setApiResult] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const { toast } = useToast()

  useEffect(() => {
    return () => {
      stopWebcam()
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
  }

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      const imageData = canvas.toDataURL("image/jpeg", 0.9)
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

  const analyzeImage = async () => {
    const imageToAnalyze = capturedImage || uploadedImage

    if (!imageToAnalyze) {
      toast({
        title: "No image selected",
        description: "Please capture or upload an image first",
        variant: "destructive",
      })
      return
    }

    setProcessingState("processing")
    setApiResult(null)

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

      setApiResult(data.result || "Analysis completed successfully")
      setProcessingState("success")

      toast({
        title: "Analysis complete",
        description: "Your image has been analyzed successfully",
      })
    } catch (error) {
      console.error("[v0] API error:", error)
      setProcessingState("error")
      setApiResult("Failed to analyze image. Please try again.")

      toast({
        title: "Analysis failed",
        description: "There was an error processing your image",
        variant: "destructive",
      })
    }
  }

  const reset = () => {
    stopWebcam()
    setMode(null)
    setCapturedImage(null)
    setUploadedImage(null)
    setProcessingState("idle")
    setApiResult(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (videoInputRef.current) {
      videoInputRef.current.value = ""
    }
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
        {isWebcamActive ? (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="relative bg-muted" style={{ minHeight: "70vh" }}>
                <video
                  ref={videoRef}
                  className="h-full w-full object-contain"
                  autoPlay
                  playsInline
                  muted
                  aria-label="Webcam stream"
                  style={{ minHeight: "70vh" }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-2 p-4">
                <Button onClick={captureImage} size="lg" className="flex-1" aria-label="Capture frame from video">
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Frame
                </Button>
                <Button variant="outline" size="lg" onClick={stopWebcam} aria-label="Stop video">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </Card>
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
                      onClick={analyzeImage}
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
                    <Button variant="outline" onClick={analyzeImage} className="w-full bg-transparent">
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
                      Choose between starting your webcam stream or uploading an image from your device
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      2
                    </span>
                    <span className="leading-relaxed">
                      If using webcam, allow camera access and capture a frame. If uploading, select your image file
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      3
                    </span>
                    <span className="leading-relaxed">Click "Analyze Image" to process your image through our API</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      4
                    </span>
                    <span className="leading-relaxed">
                      View the analysis results and use the reset button to start over
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
