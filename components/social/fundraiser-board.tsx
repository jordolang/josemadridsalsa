'use client'

import React, { useEffect, useState } from 'react'
import { getFundraiserTimeline, getFundraiserHeavyHitters, postSupportMessage } from '@/lib/actions/social-features'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { signIn, useSession } from 'next-auth/react'
import { MessageCircle, Share2, TrendingUp, Trophy, Facebook, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export function FundraiserSocialBoard({ fundraiserSlug, currentUrl }: { fundraiserSlug: string, currentUrl: string }) {
  const { data: session } = useSession()
  const [timeline, setTimeline] = useState<any[]>([])
  const [heavyHitters, setHeavyHitters] = useState<any[]>([])
  const [goal, setGoal] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [newMessage, setNewMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchData = async () => {
    try {
      const [{ timelineEvents, goal: g, currentTotal, enableSocialFeatures }, topParticipants] = await Promise.all([
        getFundraiserTimeline(fundraiserSlug),
        getFundraiserHeavyHitters(fundraiserSlug)
      ])
      
      setEnabled(enableSocialFeatures)
      setTimeline(timelineEvents)
      setGoal(g ?? 0)
      setTotalRevenue(currentTotal || 0)
      setHeavyHitters(topParticipants)
      setLoaded(true)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchData()
    // Minimal polling for live feel without overloading (every 10 seconds)
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fundraiserSlug])

  const progressPct = goal > 0 ? Math.min(100, (totalRevenue / goal) * 100) : 0

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    
    setIsSubmitting(true)
    try {
      await postSupportMessage({ fundraiserSlug, content: newMessage })
      setNewMessage('')
      toast.success('Message posted successfully!')
      fetchData() // refresh immediately
    } catch (err: any) {
      toast.error(err.message || 'Failed to post message')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleShare = () => {
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`
    window.open(facebookShareUrl, '_blank', 'width=600,height=400')
  }

  if (loaded && !enabled) return null
  if (!loaded) return <div className="py-10 text-center animate-pulse">Loading Live Social Board...</div>

  // Generate bubbles for timeline visualization on progress bar
  // We'll take the top recent contributions that have an amount > 0 mapping randomly across the filled portion securely
  const bubbleEvents = timeline.filter(t => t.amount && t.amount > 0).slice(0, 10)

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 my-10">
      
      {/* Progress Timeline Board */}
      <Card className="overflow-hidden border-2 border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-500/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                Live Funding Progress
              </CardTitle>
              <CardDescription>Real-time timeline of contributors & impact</CardDescription>
            </div>
            <Button onClick={handleShare} className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white w-full md:w-auto">
              <Facebook className="mr-2 h-4 w-4" /> Share on Facebook
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="mb-4 flex justify-between text-sm font-semibold relative">
            <span className="text-slate-600 text-lg">${totalRevenue.toFixed(2)} Raised</span>
            <span className="text-slate-500 text-lg">Goal: ${goal.toFixed(2)}</span>
          </div>
          
          <div className="relative pt-10 pb-6">
            <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 shadow-inner">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            
            {/* Timeline Bubbles Plastered on Bar */}
            <div className="absolute inset-0 flex items-center pointer-events-none px-4">
              <AnimatePresence>
                {bubbleEvents.map((ev, i) => {
                  // Distribute evenly across the current progress width
                  const leftPos = progressPct > 10 ? Math.random() * (progressPct - 5) + 2 : Math.random() * 90;
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, scale: 0, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5, type: 'spring' }}
                      className="absolute group pointer-events-auto cursor-help"
                      style={{ left: `${leftPos}%`, top: '50%', transform: 'translateY(-50%)' }}
                      title={`${ev.authorName} contributed $${ev.amount}`}
                    >
                      <Avatar className="h-10 w-10 border-2 border-white shadow-lg ring-2 ring-emerald-500 hover:scale-125 transition-transform bg-white">
                        <AvatarImage src={ev.authorAvatar || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-700 font-bold">
                          {ev.authorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs whitespace-nowrap px-3 py-1.5 rounded-lg shadow-xl z-10">
                        <p className="font-bold">{ev.authorName}</p>
                        <p className="text-green-300 font-medium">+${ev.amount}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"/>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {/* Support Feed (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-blue-500 shadow-md h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                Live Support Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col">
              
              {/* Message Input strictly requiring OAuth or Session */}
              <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
                {session ? (
                  <form onSubmit={handlePostMessage} className="flex gap-4">
                    <Avatar className="h-10 w-10 shrink-0 shadow-sm border">
                      <AvatarImage src={session.user?.image || undefined} />
                      <AvatarFallback>{session.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea 
                        placeholder="Leave a word of support for the fundraiser..." 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="resize-none min-h-[80px] bg-white border-slate-200 focus-visible:ring-blue-500"
                        disabled={isSubmitting}
                      />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || !newMessage.trim()} className="bg-blue-600 hover:bg-blue-700">
                          Post Message
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-6 space-y-4">
                    <p className="text-slate-600 font-medium">Log in to post a message of support!</p>
                    <div className="flex justify-center gap-3">
                      <Button onClick={() => signIn('facebook')} className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                        <Facebook className="mr-2 h-4 w-4" /> Continue with Facebook
                      </Button>
                      <Button onClick={() => signIn('google')} variant="outline">
                        Continue with Google
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Unfilterable Feed */}
              <div className="space-y-6 flex-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence>
                  {timeline.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 italic">No activity yet. Be the first to contribute or leave a message!</div>
                  ) : timeline.map((entry) => (
                    <motion.div 
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4"
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                        <AvatarImage src={entry.authorAvatar || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
                          {entry.authorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none p-4 w-full shadow-sm">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.authorName}</span>
                            <span className="text-xs text-slate-500 ml-2">{formatDistanceToNow(new Date(entry.createdAt))} ago</span>
                          </div>
                          
                          {/* Rich Content Display depending on type */}
                          {entry.type === 'ORDER' ? (
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
                              <span className="inline-block p-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
                                <TrendingUp className="h-3 w-3" />
                              </span>
                              Contributed ${entry.amount} {entry.participantName && `in support of ${entry.participantName}`}!
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {entry.amount && (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 font-bold mb-1">
                                  +${entry.amount} Donated
                                </Badge>
                              )}
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{entry.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Heavy Hitters (1/3 width) */}
        <div>
          <Card className="border-t-4 border-t-amber-500 h-full bg-gradient-to-b from-white to-amber-50/30 dark:from-slate-950 dark:to-amber-950/20">
            <CardHeader className="border-b bg-white/50 dark:bg-slate-950/50">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                <Trophy className="h-5 w-5" />
                Heavy Hitters
              </CardTitle>
              <CardDescription>Top 3 fundraisers leading the charge</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {heavyHitters.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic">No data yet. Get selling!</div>
              ) : (
                <div className="space-y-4">
                  {heavyHitters.map((hitter, idx) => (
                    <motion.div 
                      key={hitter.id}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`relative overflow-hidden rounded-xl border p-4 shadow-sm ${idx === 0 ? 'bg-gradient-to-br from-yellow-100 to-amber-50 border-amber-200 dark:from-yellow-900/30 dark:to-amber-900/10 dark:border-amber-700/50' : 'bg-white dark:bg-slate-900'}`}
                    >
                      {idx === 0 && <div className="absolute top-0 right-0 p-1 bg-amber-200 text-amber-700 text-[10px] font-bold rounded-bl-lg">#1 SELLER</div>}
                      <div className="flex items-center gap-3 relative z-10">
                        <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-lg ${idx===0?'bg-amber-400 text-white shadow-inner shadow-amber-300':idx===1?'bg-slate-300 text-slate-700 shadow-inner' : 'bg-orange-300 text-orange-800 shadow-inner'}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{hitter.name}</h4>
                          <p className="text-sm text-slate-500 truncate">{hitter.totalOrders} total sales</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold ${idx===0?'text-2xl text-amber-600': 'text-xl text-green-600'}`}>
                            ${hitter.totalRevenue}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  <div className="mt-8 text-center pt-4 border-t border-amber-100 dark:border-amber-900/30">
                    <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">🏆 Top seller wins a $1,000 scholarship matched by Jose Madrid!</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
