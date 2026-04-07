'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { getMonthlyChampionship } from '@/lib/actions/social-features'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Trophy, TrendingUp, Medal, Flame, Calendar as CalIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

export default function FundraiserBattlesPage() {
  const [data, setData] = useState<any>(null)
  const { currentMonth, currentYear } = useMemo(() => {
    const now = new Date()
    return { currentMonth: now.getMonth() + 1, currentYear: now.getFullYear() }
  }, [])

  useEffect(() => {
    const fetchLead = async () => {
      try {
         const res = await getMonthlyChampionship(currentMonth, currentYear)
         setData(res)
      } catch (err) {
         console.error(err)
      }
    }
    fetchLead()
    const int = setInterval(fetchLead, 15000)
    return () => clearInterval(int)
  }, [currentMonth, currentYear])

  if (!data) return <div className="min-h-screen pt-20 text-center animate-pulse"><Trophy className="mx-auto h-12 w-12 text-slate-300 animate-bounce mb-4"/>Loading Live Leaderboard...</div>

  const leaderboard = data.currentLeaderboard || []
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 text-white py-16 px-4 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -top-24 -right-24 h-64 w-64 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 h-64 w-64 bg-yellow-400/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm font-bold uppercase tracking-widest mb-6">
            <Flame className="h-4 w-4 text-yellow-300" /> Live Unfiltered Leaderboard
          </motion.div>
          <motion.h1 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-md">
            Fundraising <span className="text-yellow-300">Battles</span>
          </motion.h1>
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-xl md:text-2xl text-amber-50 max-w-3xl mx-auto font-medium leading-relaxed">
            The winning team this month gets a <span className="font-extrabold text-white underline decoration-yellow-400 decoration-4">$1000 prize</span> and the top seller receives a <span className="font-extrabold text-white underline decoration-yellow-400 decoration-4">$1000 matched scholarship!</span>
          </motion.p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-20">
        
        {/* Current Leaderboard */}
        <Card className="border-t-4 border-t-amber-400 shadow-2xl mb-12">
          <CardHeader className="bg-white dark:bg-slate-900 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <Trophy className="h-8 w-8 text-amber-500" />
                  {format(new Date(), 'MMMM')} Championship
                </CardTitle>
                <CardDescription className="text-base mt-1">Live head-to-head competition across all active fundraisers.</CardDescription>
              </div>
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm text-slate-500 font-medium tracking-wide uppercase">Top Prize</span>
                <span className="text-2xl font-black text-green-600 bg-green-100 px-3 py-1 rounded-lg border border-green-200">$1,000</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50">
            {leaderboard.length === 0 ? (
               <div className="text-center py-20">
                 <Medal className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                 <h3 className="text-2xl font-bold text-slate-700">No active battles this month!</h3>
                 <p className="text-slate-500 mt-2">Start a fundraiser to claim the #1 spot.</p>
               </div>
            ) : (
               <div className="space-y-4 sm:space-y-6">
                 <AnimatePresence>
                   {leaderboard.map((f: any, idx: number) => {
                     const isFirst = idx === 0;
                     return (
                       <motion.div 
                         key={f.id}
                         layout
                         initial={{ opacity: 0, x: -50 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.4, delay: idx * 0.1 }}
                         className={`relative flex flex-col sm:flex-row items-center gap-6 p-4 sm:p-6 rounded-2xl transform transition-all duration-300 hover:scale-[1.01] overflow-hidden group
                           ${isFirst ? 'bg-gradient-to-r from-amber-100 to-yellow-50 dark:from-yellow-900/40 dark:to-slate-900 border-2 border-amber-400 shadow-lg shadow-amber-500/10' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md'}`}
                       >
                         {/* Rank Bubble */}
                         <div className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-full font-black text-2xl shadow-inner
                           ${isFirst ? 'bg-amber-400 text-white shadow-amber-300 outline outline-4 outline-amber-200/50' : 
                             idx === 1 ? 'bg-slate-300 text-slate-700 outline outline-4 outline-slate-200/50' : 
                             idx === 2 ? 'bg-orange-300 text-orange-800 outline outline-4 outline-orange-200/50' : 
                             'bg-slate-100 text-slate-500 border-2 border-slate-200'}`}
                         >
                           {idx + 1}
                         </div>

                         {/* Details */}
                         <div className="flex-1 text-center sm:text-left min-w-0">
                           <a href={`/f/${f.slug}`} className="hover:underline">
                             <h2 className={`font-bold truncate ${isFirst ? 'text-2xl sm:text-3xl text-amber-900 dark:text-amber-100' : 'text-xl sm:text-2xl text-slate-800 dark:text-slate-200'}`}>
                               {f.name}
                             </h2>
                           </a>
                           <p className="text-slate-600 dark:text-slate-400 font-medium truncate mt-1">
                             {f.organizationName}
                           </p>
                           
                           {/* Sub Progress Bar for visual comparison */}
                           {isFirst && leaderboard.length > 1 && (
                             <div className="mt-4">
                               <div className="h-2 w-full bg-amber-200/50 dark:bg-amber-900/30 rounded-full overflow-hidden">
                                 <motion.div 
                                   className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                                   initial={{ width: 0 }}
                                   animate={{ width: '100%' }}
                                   transition={{ duration: 1 }}
                                 />
                               </div>
                               <p className="text-xs font-bold text-amber-700 dark:text-amber-500 mt-1 uppercase tracking-wider">Current Champion</p>
                             </div>
                           )}
                           
                           {!isFirst && leaderboard[0] && (
                             <div className="mt-3">
                               <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <motion.div 
                                   className="h-full bg-blue-400 dark:bg-blue-600"
                                   initial={{ width: 0 }}
                                   animate={{ width: `${Math.max(5, (f.totalRevenue / leaderboard[0].totalRevenue) * 100)}%` }}
                                   transition={{ duration: 1 }}
                                 />
                               </div>
                               <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">
                                 ${(leaderboard[0].totalRevenue - f.totalRevenue).toFixed(2)} behind leader
                               </p>
                             </div>
                           )}
                         </div>

                         {/* Mini Heavy Hitter Callout */}
                         <div className="hidden lg:block w-48 border-l border-slate-200 dark:border-slate-800 pl-6">
                           <p className="text-xs uppercase font-bold text-slate-400 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3"/> Top Seller</p>
                           {f.topParticipant ? (
                             <div>
                               <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f.topParticipant.name}</p>
                               <Badge text={`$${f.topParticipant.revenue.toFixed(2)}`} isLeader={isFirst} />
                             </div>
                           ) : <p className="text-sm text-slate-400 italic">No sales yet</p>}
                         </div>

                         {/* Revenue Total */}
                         <div className="shrink-0 text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                           <p className="text-sm uppercase font-bold text-slate-500 mb-1">Total Raised</p>
                           <p className={`font-black text-3xl sm:text-4xl ${isFirst ? 'text-green-600 dark:text-green-400 drop-shadow-sm' : 'text-slate-700 dark:text-slate-300'}`}>
                             ${f.totalRevenue.toFixed(2)}
                           </p>
                         </div>
                         
                         {/* Absolute Ribbon for winner */}
                         {isFirst && (
                           <div className="absolute top-4 right-4 animate-pulse">
                             <Flame className="h-8 w-8 text-orange-500 opacity-50" />
                           </div>
                         )}
                       </motion.div>
                     );
                   })}
                 </AnimatePresence>
               </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

function Badge({ text, isLeader }: { text: string, isLeader: boolean }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-sm font-bold ${isLeader ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-green-100 text-green-800 border-green-200'} border mt-1`}>
      {text}
    </span>
  )
}
