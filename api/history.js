import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const getQueryId = (req) => {
  const id = req.query?.id;
  return Array.isArray(id) ? id[0] : id;
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = getQueryId(req);

      if (id) {
        const { data, error } = await supabase
          .from('resume_results')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Analysis not found' });

        return res.status(200).json(data);
      }

      const { data, error } = await supabase
        .from('resume_results')
        .select('id, detected_skills, suggested_roles, resume_score, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        analyses: (data || []).map((item) => ({
          ...item,
          skillCount: item.detected_skills?.length || 0,
          createdAt: new Date(item.created_at).toLocaleDateString(),
        })),
      });
    }

    if (req.method === 'DELETE') {
      const id = getQueryId(req) || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'Analysis id is required' });
      }

      const { error } = await supabase
        .from('resume_results')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Analysis deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'History operation failed', details: error.message });
  }
}
