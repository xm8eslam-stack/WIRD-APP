import { DeterministicAdvisorEngine, PerformanceAnalysisReport } from './deterministicAdvisor';
import { DailyLog, UserProfile, PortionStatusRecord, WeakVerseItem, MemorizationPlan } from '../types/quran';
import { calculateUniqueMemorizedAyahs, getPrioritizedRevisionQueue, getLocalDateString } from './unifiedPortionService';

export interface AdvisorStatus {
  available: boolean;
  mode: 'gemini_free' | 'deterministic_fallback';
  model: string;
  message: string;
}

export interface AdvisorResponse {
  success: boolean;
  text: string;
  isFallback: boolean;
  code?: 'SUCCESS' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'KEY_MISSING' | 'FALLBACK_USED';
  report?: PerformanceAnalysisReport;
}

export const AdvisorService = {
  // Check AI availability from server
  async checkStatus(): Promise<AdvisorStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/advisor/status', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          return {
            available: true,
            mode: 'gemini_free',
            model: 'gemini-3.8-flash (Free Tier)',
            message: 'مستشار الذكاء الاصطناعي متاح (Gemini Free Tier)'
          };
        }
      }

      return {
        available: false,
        mode: 'deterministic_fallback',
        model: 'المحرك الذاتي الحتمي',
        message: 'يعمل في النمط الذاتي الحتمي (بدون استهلاك رصيد أو مفاتيح)'
      };
    } catch {
      // In offline or purely static deploy
      return {
        available: false,
        mode: 'deterministic_fallback',
        model: 'المحرك الذاتي الحتمي',
        message: 'يعمل في النمط الذاتي الحتمي (بدون استهلاك رصيد أو مفاتيح)'
      };
    }
  },

  // Analyze progress and history
  async analyzeProgress(
    contextType: string,
    logs: DailyLog[],
    profile: UserProfile,
    plans: MemorizationPlan[],
    portions: PortionStatusRecord[],
    weakVerses: WeakVerseItem[],
    customQuery?: string
  ): Promise<AdvisorResponse> {
    // 1. Always generate deterministic report as baseline
    const deterministicReport = DeterministicAdvisorEngine.analyzeHistory(logs, profile, portions, weakVerses);

    // 2. Pre-generate deterministic fallback text
    let fallbackText = '';
    if (contextType === 'workload') {
      fallbackText = `💡 تحليل وتعديل حجم الحفظ اليومي:
• نمط الإنجاز الحالي: ${deterministicReport.missedTasksPattern}
• الأسباب المرصودة: ${deterministicReport.difficultyReasons.join(' - ')}
• التعديل المقترح: ${deterministicReport.suggestedWorkloadAdjustments.join('\n• ')}`;
    } else if (contextType === 'priorities') {
      fallbackText = `🎯 أولويات المراجعة والتثبيت العاجلة:
${deterministicReport.revisionPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

💡 توجيه: تقديم مراجعة هذه المقاطع في ورد اليوم قبل البدء بأي حفظ جديد.`;
    } else if (contextType === 'weekly_summary') {
      fallbackText = `📊 ملخص الإنجاز الأسبوعي:
• إجمالي دقائق التعاهد: ${deterministicReport.weeklySummary.totalMinutes} دقيقة.
• الآيات المحفوظة: ${deterministicReport.weeklySummary.totalAyahsMemorized} آية.
• الأوجه المراجعة: ${deterministicReport.weeklySummary.totalPagesReviewed} وجه.
• معدل الثبات والاستمرارية: ${deterministicReport.weeklySummary.consistencyScore}.`;
    } else {
      fallbackText = `تقرير التحليل القرآني الشامل:
• نمط الالتزام: ${deterministicReport.missedTasksPattern}
• التوصيات المقترحة:
${deterministicReport.practicalRecommendations.map(r => `• ${r}`).join('\n')}
• أولويات التثبيت:
${deterministicReport.revisionPriorities.map(p => `• ${p}`).join('\n')}`;
    }

    // 3. Attempt server-side Gemini Free Tier call
    try {
      const activePlan = plans.find(p => p.isActive) || plans[0];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contextType,
          query: customQuery,
          userData: {
            goal: profile.memorizationGoal || 'حفظ القرآن الكريم',
            activePlanTitle: activePlan?.title || 'خطة الحفظ',
            memorizedAyahsCount: calculateUniqueMemorizedAyahs(portions).uniqueCount,
            weakVersesCount: weakVerses.length,
            retentionScore: deterministicReport.completionRate || 0,
            dueRevisionsCount: getPrioritizedRevisionQueue(portions, { todayStr: getLocalDateString(), maxDailyLimit: 20 }).totalDueCount
          }
        })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text) {
          return {
            success: true,
            text: data.text,
            isFallback: false,
            code: 'SUCCESS',
            report: deterministicReport
          };
        }
        if (data.code === 'QUOTA_EXHAUSTED') {
          return {
            success: true,
            text: fallbackText,
            isFallback: true,
            code: 'QUOTA_EXHAUSTED',
            report: deterministicReport
          };
        }
      }
    } catch (e) {
      console.info('Using deterministic advisor fallback:', e);
    }

    return {
      success: true,
      text: fallbackText,
      isFallback: true,
      code: 'FALLBACK_USED',
      report: deterministicReport
    };
  },

  // Interactive Chat
  async sendChatMessage(
    message: string,
    history: Array<{ sender: 'user' | 'advisor'; text: string }>
  ): Promise<AdvisorResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ message, history })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text) {
          return {
            success: true,
            text: data.text,
            isFallback: false,
            code: 'SUCCESS'
          };
        }
      }
    } catch {
      // Fallback
    }

    // Deterministic answer
    const fallbackAnswer = DeterministicAdvisorEngine.answerQuestion(message);
    return {
      success: true,
      text: fallbackAnswer,
      isFallback: true,
      code: 'FALLBACK_USED'
    };
  }
};
