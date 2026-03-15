const groupsService = require('./groups.service');
const { success, created, paginated, notFound } = require('../../utils/response');

class GroupsController {
  async listGroups(req, res, next) {
    try {
      const { data, total, page, limit } = await groupsService.listGroups(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async getGroup(req, res, next) {
    try {
      const group = await groupsService.getGroup(req.params.id);
      return success(res, group);
    } catch (err) { next(err); }
  }

  async createGroup(req, res, next) {
    try {
      const group = await groupsService.createGroup(req.user.id, req.body, false);
      return created(res, group, 'Groupe créé avec succès');
    } catch (err) { next(err); }
  }

  async createGroupAdmin(req, res, next) {
    try {
      const group = await groupsService.createGroup(req.user.id, req.body, true);
      return created(res, group, 'Groupe créé par admin');
    } catch (err) { next(err); }
  }

  async updateGroup(req, res, next) {
    try {
      const group = await groupsService.updateGroup(req.params.id, req.user.id, req.body, false);
      return success(res, group, 'Groupe mis à jour');
    } catch (err) { next(err); }
  }

  async joinGroup(req, res, next) {
    try {
      const result = await groupsService.joinGroup(req.params.id, req.user.id);
      return success(res, result);
    } catch (err) { next(err); }
  }

  async leaveGroup(req, res, next) {
    try {
      const result = await groupsService.leaveGroup(req.params.id, req.user.id);
      return success(res, result, 'Participation annulée, remboursement en cours');
    } catch (err) { next(err); }
  }

  async getGroupProgress(req, res, next) {
    try {
      return success(res, await groupsService.getGroupProgress(req.params.id));
    } catch (err) { next(err); }
  }

  async closeGroup(req, res, next) {
    try {
      const group = await groupsService.closeGroup(req.params.id, req.user.id);
      return success(res, group, 'Groupe fermé');
    } catch (err) { next(err); }
  }
}

module.exports = new GroupsController();
