/**
 * Vercel serverless function: /api/submissions/[id]
 *
 *   GET    /api/submissions/:id  → single submission detail (incl. seedlings + photos)
 *   DELETE /api/submissions/:id  → remove submission (cascade deletes children)
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const id = req.query?.id as string;
  if (!id) {
    return res.status(400).json({ error: 'id param is required' });
  }

  // GET — fetch with relations
  if (req.method === 'GET') {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id },
        include: { seedlings: true, photos: true },
      });
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      return res.status(200).json({ status: 'success', data: submission });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      await prisma.submission.delete({ where: { id } });
      return res.status(200).json({ status: 'success', message: 'Submission deleted' });
    } catch (err: any) {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Submission not found' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
