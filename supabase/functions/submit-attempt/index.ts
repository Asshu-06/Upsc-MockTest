// Supabase Edge Function: submit-attempt
// Deno runtime environment for secure, server-side exam attempt scoring

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnswerItem {
  question_id: string;
  selected_option: "A" | "B" | "C" | "D" | null;
}

interface SubmitPayload {
  attempt_id: string;
  answers: AnswerItem[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Auth client from request header to identify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Admin client for secure data read/write
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const payload: SubmitPayload = await req.json();
    const { attempt_id, answers } = payload;

    if (!attempt_id) {
      return new Response(JSON.stringify({ error: "attempt_id is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Attempt
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("id", attempt_id)
      .single();

    if (attemptErr || !attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (attempt.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access to attempt" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (attempt.status === "completed") {
      return new Response(JSON.stringify({ error: "Attempt is already completed" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch Paper configuration
    const { data: paper, error: paperErr } = await supabaseAdmin
      .from("papers")
      .select("*")
      .eq("id", attempt.paper_id)
      .single();

    if (paperErr || !paper) {
      return new Response(JSON.stringify({ error: "Paper not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch Questions with Correct Answer Key
    const { data: questions, error: qErr } = await supabaseAdmin
      .from("questions")
      .select("id, question_number, correct_option")
      .eq("paper_id", paper.id);

    if (qErr || !questions) {
      return new Response(JSON.stringify({ error: "Failed to fetch paper questions" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const marksPerQ = Number(paper.marks_per_question ?? 1);
    const negativeMark = Number(paper.negative_marking ?? 0);

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let totalScore = 0;

    const answerRecordsToInsert: any[] = [];
    const answersMap = new Map<string, string | null>();
    (answers || []).forEach((a) => {
      if (a.question_id) answersMap.set(a.question_id, a.selected_option || null);
    });

    for (const q of questions) {
      const selected = answersMap.get(q.id) || null;
      let isCorrect: boolean | null = null;
      let marksObtained = 0;

      if (!selected) {
        unansweredCount++;
        isCorrect = null;
        marksObtained = 0;
      } else if (selected === q.correct_option) {
        correctCount++;
        isCorrect = true;
        marksObtained = marksPerQ;
      } else {
        incorrectCount++;
        isCorrect = false;
        marksObtained = -Math.abs(negativeMark);
      }

      totalScore += marksObtained;

      answerRecordsToInsert.push({
        attempt_id: attempt.id,
        question_id: q.id,
        selected_option: selected,
        is_correct: isCorrect,
        marks_obtained: marksObtained,
      });
    }

    const totalAttempted = correctCount + incorrectCount;
    const accuracy = totalAttempted > 0 ? Number(((correctCount / totalAttempted) * 100).toFixed(2)) : 0;
    totalScore = Number(totalScore.toFixed(2));

    // 4. Batch upsert attempt_answers
    if (answerRecordsToInsert.length > 0) {
      await supabaseAdmin.from("attempt_answers").upsert(answerRecordsToInsert, {
        onConflict: "attempt_id,question_id",
      });
    }

    // 5. Update Attempt record
    const { data: updatedAttempt, error: updateErr } = await supabaseAdmin
      .from("attempts")
      .update({
        status: "completed",
        score: totalScore,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unanswered_count: unansweredCount,
        accuracy: accuracy,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to update attempt result" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 6. Fetch immediately previous completed attempt for comparison
    const { data: prevAttempts } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("paper_id", paper.id)
      .eq("status", "completed")
      .neq("id", attempt.id)
      .order("attempt_number", { ascending: false })
      .limit(1);

    const prevAttempt = prevAttempts && prevAttempts.length > 0 ? prevAttempts[0] : null;

    let comparison = null;
    if (prevAttempt) {
      comparison = {
        prev_attempt_number: prevAttempt.attempt_number,
        prev_score: prevAttempt.score,
        prev_accuracy: prevAttempt.accuracy,
        prev_correct_count: prevAttempt.correct_count,
        prev_incorrect_count: prevAttempt.incorrect_count,
        prev_unanswered_count: prevAttempt.unanswered_count,
        score_diff: Number((totalScore - Number(prevAttempt.score)).toFixed(2)),
        accuracy_diff: Number((accuracy - Number(prevAttempt.accuracy)).toFixed(2)),
        correct_diff: correctCount - prevAttempt.correct_count,
        incorrect_diff: incorrectCount - prevAttempt.incorrect_count,
        unanswered_diff: unansweredCount - prevAttempt.unanswered_count,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        attempt: updatedAttempt,
        comparison: comparison,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
