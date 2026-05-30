import { groupRepository } from '../repositories/group.repository';
import { academicRepository } from '../repositories/academic.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/apiResponse';
import { Group, UserRole } from '@prisma/client';

export class GroupService {
  /**
   * Thành lập nhóm tự động & đăng ký đề tài (Sinh viên tự làm hoặc Giáo viên tạo hộ)
   */
  async createGroup(data: { name: string; topicName: string; classId: string; studentIds: string[] }): Promise<Group> {
    const { name, topicName, classId, studentIds } = data;

    // 1. Kiểm tra tồn tại lớp học
    const clazz = await academicRepository.findClassById(classId);
    if (!clazz) {
      throw new NotFoundError("Không tìm thấy lớp học phần đã chọn");
    }

    // 2. Kiểm duyệt trạng thái niên khóa xem lớp này có khóa điểm chưa
    if (clazz.term.isLocked) {
      throw new BadRequestError(`Học kỳ '${clazz.term.name}' đã đóng. Không thể thành lập nhóm mới!`);
    }

    // 3. Kiểm duyệt danh sách sinh viên tham gia nhóm
    const students = await groupRepository.findStudentsForValidation(studentIds);
    if (students.length !== studentIds.length) {
      throw new BadRequestError("Danh sách ID sinh viên chứa phần tử không tồn tại thực tế");
    }

    // 4. Ràng buộc: Tất cả sinh viên phải đã enroll vào lớp học phần này và CHƯA có nhóm trong cùng LHP
    for (const student of students) {
      const isEnrolled = student.enrollments.some(e => e.classId === classId);
      if (!isEnrolled) {
        throw new BadRequestError(`Sinh viên '${student.user.fullName}' không đăng ký lớp học phần này`);
      }
      const hasGroupInClass = student.groupMemberships.some(gm => gm.group.classId === classId);
      if (hasGroupInClass) {
        throw new BadRequestError(`Sinh viên '${student.user.fullName}' đã thuộc nhóm khác trong lớp này`);
      }
    }

    return await groupRepository.createGroup(data);
  }

  /**
   * Cập nhật tên đề tài nghiên cứu báo cáo
   */
  async updateTopic(id: string, topicName: string, actorId: string, role: UserRole): Promise<Group> {
    const group = await groupRepository.findGroupById(id);
    if (!group) {
      throw new NotFoundError("Không tìm thấy nhóm yêu cầu");
    }

    // Kiểm duyệt niên khóa
    const clazz = await academicRepository.findClassById(group.classId);
    if (clazz && clazz.term.isLocked) {
      throw new BadRequestError("Học kỳ đã đóng. Không thể sửa đổi đề tài!");
    }

    // Ràng buộc bảo mật: Sinh viên chỉ được sửa đề tài của CHÍNH NHÓM MÌNH
    if (role === UserRole.STUDENT) {
      const isMember = group.members.some(m => m.student.id === actorId);
      if (!isMember) {
        throw new ForbiddenError("Bạn không có quyền sửa đổi đề tài của nhóm khác");
      }
    }

    return await groupRepository.updateTopic(id, topicName);
  }

  /**
   * Điều chỉnh danh sách thành viên trong nhóm (Chỉ dành cho Giảng viên hoặc Admin/PDT)
   */
  async updateMembers(id: string, studentIds: string[]): Promise<void> {
    const group = await groupRepository.findGroupById(id);
    if (!group) {
      throw new NotFoundError("Không tìm thấy thông tin nhóm yêu cầu");
    }

    // Kiểm duyệt niên khóa
    const clazz = await academicRepository.findClassById(group.classId);
    if (clazz && clazz.term.isLocked) {
      throw new BadRequestError("Học kỳ đã đóng. Không thể thay đổi thành viên!");
    }

    // Kiểm duyệt sinh viên mới được chọn
    const students = await groupRepository.findStudentsForValidation(studentIds);
    if (students.length !== studentIds.length) {
      throw new BadRequestError("Danh sách thành viên mới chứa sinh viên không tồn tại");
    }

    for (const student of students) {
      const isEnrolled = student.enrollments.some(e => e.classId === group.classId);
      if (!isEnrolled) {
        throw new BadRequestError(`Sinh viên '${student.user.fullName}' không đăng ký lớp học phần này`);
      }
      // Sinh viên được phép tham gia nếu chưa có nhóm KHÁC trong cùng LHP
      const existingGroupInClass = student.groupMemberships.find(gm => gm.group.classId === group.classId);
      if (existingGroupInClass && existingGroupInClass.groupId !== id) {
        throw new BadRequestError(`Sinh viên '${student.user.fullName}' đã thuộc về một nhóm khác trong lớp này`);
      }
    }

    await groupRepository.updateMembers(id, studentIds);
  }

  /**
   * Lấy chi tiết nhóm kèm thành viên
   */
  async getGroupById(id: string) {
    const group = await groupRepository.findGroupById(id);
    if (!group) {
      throw new NotFoundError("Không tìm thấy nhóm yêu cầu");
    }
    return group;
  }

  /**
   * Xem toàn bộ danh sách nhóm của một Lớp học phần
   */
  async getGroupsByClassId(classId: string) {
    await academicRepository.findClassById(classId); // Check tồn tại lớp
    return await groupRepository.findGroupsByClassId(classId);
  }
}

export const groupService = new GroupService();
