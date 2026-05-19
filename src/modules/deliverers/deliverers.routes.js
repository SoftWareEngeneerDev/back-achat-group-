// ============================================================
// DELIVERERS PUBLIC ROUTES — Liste publique des livreurs
// Base URL : /api/v1/deliverers
// ============================================================
const router = require('express').Router();
const prisma  = require('../../config/database');
const { success } = require('../../utils/response');

/**
 * GET /deliverers/public
 * Liste les livreurs ACTIVE avec filtre optionnel ?zone=
 */
router.get('/deliverers/public', async (req, res, next) => {
  try {
    const where = { status: 'ACTIVE' };
    if (req.query.zone) {
      where.zone = { contains: req.query.zone, mode: 'insensitive' };
    }
    const deliverers = await prisma.deliverer.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id         : true,
        name       : true,
        phone      : true,
        photoUrl   : true,
        zone       : true,
        description: true,
        tarif      : true,
      },
    });
    return success(res, deliverers);
  } catch (err) { next(err); }
});

module.exports = router;
