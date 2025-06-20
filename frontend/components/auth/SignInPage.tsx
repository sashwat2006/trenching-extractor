"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Brain, Cloud, Loader2, Lock, Shield, Sparkles } from "lucide-react"

interface SignInPageProps {
  isLoggingIn: boolean
  onLogin: () => void
}

export function SignInPage({ isLoggingIn, onLogin }: SignInPageProps) {
  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Side - Hero Content */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="max-w-lg">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Cloud_Extel
            </span>
          </div>

          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Municipal Demand Note{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Parser</span>
          </h1>

          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            State-of-the-art NLP-powered extraction platform for Regional Trenching Demand Notes across 6 municipal
            authorities.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-cyan-500/20 rounded-full">
                <Brain className="h-4 w-4 text-cyan-400" />
              </div>
              <span className="text-gray-300">AI-powered document processing</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-green-500/20 rounded-full">
                <Sparkles className="h-4 w-4 text-green-400" />
              </div>
              <span className="text-gray-300">99.2% accuracy across all authorities</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-purple-500/20 rounded-full">
                <Lock className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-gray-300">Enterprise-grade security</span>
            </div>
          </div>

          <div className="text-sm text-gray-500">Trusted by infrastructure teams across Maharashtra</div>
        </div>
      </div>

      {/* Right Side - Sign In */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-8">
        <Card className="w-full max-w-md shadow-2xl border border-gray-800 bg-gray-900/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-6 pb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
              <CardDescription className="text-gray-400 mt-2">
                Sign in with your Microsoft account to continue
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              size="lg"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5 mr-3" />
                  Continue with Microsoft
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Secure authentication powered by <span className="font-medium text-gray-400">Microsoft Graph API</span>
              </p>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-white">6</div>
                  <div className="text-xs text-gray-500">Authorities</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">1.2K+</div>
                  <div className="text-xs text-gray-500">Processed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">2.3s</div>
                  <div className="text-xs text-gray-500">Avg Time</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
