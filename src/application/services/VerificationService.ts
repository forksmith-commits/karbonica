import { v4 as uuidv4 } from 'uuid';
import { IVerificationRequestRepository } from '../../domain/repositories/IVerificationRequestRepository';
import { IVerificationEventRepository } from '../../domain/repositories/IVerificationEventRepository';
import { IVerificationDocumentRepository } from '../../domain/repositories/IVerificationDocumentRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { VerificationRequest, VerificationStatus } from '../../domain/entities/VerificationRequest';
import { VerificationEvent } from '../../domain/entities/VerificationEvent';
import {
  VerificationDocument,
  CreateVerificationDocumentData,
} from '../../domain/entities/VerificationDocument';
import { ProjectStatus } from '../../domain/entities/Project';
import { UserRole } from '../../domain/entities/User';
import { IEmailService } from '../../domain/services/IEmailService';
import { CreditService } from './CreditService';
import { logger } from '../../utils/logger';

export class VerificationService {
  constructor(
    private verificationRepository: IVerificationRequestRepository,
    private verificationEventRepository: IVerificationEventRepository,
    private verificationDocumentRepository: IVerificationDocumentRepository,
    private userRepository: IUserRepository,
    private emailService: IEmailService,
    private projectRepository?: IProjectRepository,
    private creditService?: CreditService
  ) {}

  /**
   * Assign a verifier to a verification request
   * Requirements: 4.1, 4.3, 8.7
   */
  async assignVerifier(
    verificationId: string,
    verifierId: string,
    assignedBy: string,
    assignedByRole: UserRole
  ): Promise<VerificationRequest> {
    // Validate user is administrator (Requirement 8.7)
    if (assignedByRole !== UserRole.ADMINISTRATOR) {
      throw new Error('Only administrators can assign verifiers');
    }

    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Validate verifier exists and has verifier role
    const verifier = await this.userRepository.findById(verifierId);
    if (!verifier) {
      throw new Error('Verifier not found');
    }

    if (verifier.role !== UserRole.VERIFIER && verifier.role !== UserRole.ADMINISTRATOR) {
      throw new Error('User must have verifier or administrator role');
    }

    // Update verification status to "in_review" and progress to 30% (Requirement 4.3)
    verification.verifierId = verifierId;
    verification.status = VerificationStatus.IN_REVIEW;
    verification.progress = 30;
    verification.assignedAt = new Date();

    const updatedVerification = await this.verificationRepository.update(verification);

    // Create timeline event (Requirement 4.1)
    const timelineEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType: 'verifier_assigned',
      message: `Verifier ${verifier.name} assigned to verification`,
      userId: assignedBy,
      metadata: {
        verifierId: verifierId,
        verifierName: verifier.name,
        verifierEmail: verifier.email,
      },
      createdAt: new Date(),
    };

    await this.verificationEventRepository.save(timelineEvent);

    // Send notification to verifier (Requirement 4.1)
    try {
      const projectName = 'the project'; // We'll need to fetch this from project if needed

      await this.emailService.sendNotificationEmail(
        verifier.email,
        'New Verification Assignment - Karbonica',
        this.generateVerifierAssignmentEmail(verifier.name, projectName, verificationId)
      );

      logger.info('Verifier assignment notification sent', {
        verificationId,
        verifierId,
        verifierEmail: verifier.email,
      });
    } catch (error) {
      logger.error('Failed to send verifier assignment notification', {
        error,
        verificationId,
        verifierId,
      });
      // Don't fail the assignment if email fails
    }

    logger.info('Verifier assigned to verification', {
      verificationId,
      verifierId,
      assignedBy,
      status: updatedVerification.status,
      progress: updatedVerification.progress,
    });

    return updatedVerification;
  }

  /**
   * Upload a document for a verification request
   * Requirements: 4.4, 4.10
   */
  async uploadDocument(
    verificationId: string,
    documentData: CreateVerificationDocumentData,
    uploadedBy: string,
    uploaderRole: UserRole
  ): Promise<VerificationDocument> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only assigned verifier, developer, or administrator can upload documents
    if (
      uploaderRole !== UserRole.ADMINISTRATOR &&
      verification.verifierId !== uploadedBy &&
      verification.developerId !== uploadedBy
    ) {
      throw new Error('You do not have permission to upload documents for this verification');
    }

    // Save document to database (Requirement 4.4)
    const document = await this.verificationDocumentRepository.save({
      ...documentData,
      uploadedBy,
    });

    // Create timeline event (Requirement 4.10)
    const timelineEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType: 'document_uploaded',
      message: `Document "${document.name}" uploaded`,
      userId: uploadedBy,
      metadata: {
        documentId: document.id,
        documentName: document.name,
        documentType: document.documentType,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
      },
      createdAt: new Date(),
    };

    await this.verificationEventRepository.save(timelineEvent);

    logger.info('Verification document uploaded', {
      verificationId,
      documentId: document.id,
      documentName: document.name,
      uploadedBy,
      fileSize: document.fileSize,
    });

    return document;
  }

  /**
   * Add a timeline event to a verification request
   * Requirements: 4.5, 4.10
   */
  async addTimelineEvent(
    verificationId: string,
    eventType: string,
    message: string,
    userId: string,
    userRole: UserRole,
    metadata?: Record<string, unknown>
  ): Promise<VerificationEvent> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only assigned verifier, developer, or administrator can add timeline events
    if (
      userRole !== UserRole.ADMINISTRATOR &&
      verification.verifierId !== userId &&
      verification.developerId !== userId
    ) {
      throw new Error('You do not have permission to add timeline events for this verification');
    }

    // Create timeline event (Requirements 4.5, 4.10)
    const timelineEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType,
      message,
      userId,
      metadata: metadata || null,
      createdAt: new Date(),
    };

    const savedEvent = await this.verificationEventRepository.save(timelineEvent);

    logger.info('Timeline event added to verification', {
      verificationId,
      eventId: savedEvent.id,
      eventType,
      userId,
    });

    return savedEvent;
  }

  /**
   * Get timeline events for a verification request
   * Requirements: 4.5, 4.10
   */
  async getTimelineEvents(
    verificationId: string,
    userId: string,
    userRole: UserRole
  ): Promise<VerificationEvent[]> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only assigned verifier, developer, or administrator can view timeline events
    if (
      userRole !== UserRole.ADMINISTRATOR &&
      verification.verifierId !== userId &&
      verification.developerId !== userId
    ) {
      throw new Error('You do not have permission to view timeline events for this verification');
    }

    // Get timeline events (Requirements 4.5, 4.10)
    const events = await this.verificationEventRepository.findByVerificationId(verificationId);

    logger.info('Timeline events retrieved for verification', {
      verificationId,
      eventCount: events.length,
      userId,
    });

    return events;
  }

  /**
   * Approve a verification request
   * Requirements: 4.6, 4.7, 4.11, 8.8
   */
  async approve(
    verificationId: string,
    notes: string | null,
    userId: string,
    userRole: UserRole
  ): Promise<VerificationRequest> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only assigned verifier or administrator can approve (Requirements 8.8)
    if (userRole !== UserRole.ADMINISTRATOR && verification.verifierId !== userId) {
      throw new Error('You do not have permission to approve this verification');
    }

    // Validate verification is in correct status
    if (verification.status !== VerificationStatus.IN_REVIEW) {
      throw new Error('Verification must be in review status to be approved');
    }

    // Validate at least 3 documents are present (Requirement 4.6)
    const documents = await this.verificationDocumentRepository.findByVerification(verificationId);
    if (documents.length < 3) {
      throw new Error('At least 3 documents must be uploaded before approval');
    }

    // Update verification status to "approved" and progress to 100% (Requirement 4.7)
    verification.status = VerificationStatus.APPROVED;
    verification.progress = 100;
    verification.completedAt = new Date();
    if (notes) {
      verification.notes = notes;
    }

    const updatedVerification = await this.verificationRepository.update(verification);

    // Update project status to "verified" (Requirement 4.7)
    if (this.projectRepository) {
      const project = await this.projectRepository.findById(verification.projectId);
      if (project) {
        project.status = ProjectStatus.VERIFIED;
        await this.projectRepository.update(project);

        logger.info('Project status updated to verified', {
          projectId: project.id,
          verificationId,
          approvedBy: userId,
        });

        // Issue carbon credits automatically (Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.8)
        if (this.creditService) {
          try {
            logger.info('Attempting to issue credits after project verification', {
              projectId: verification.projectId,
              verificationId,
              projectStatus: project.status,
            });
            
            const { creditEntry, transaction } = await this.creditService.issueCredits(
              verification.projectId,
              verificationId
            );

            logger.info('Credits issued automatically on verification approval', {
              verificationId,
              projectId: verification.projectId,
              creditId: creditEntry.creditId,
              creditEntryId: creditEntry.id,
              transactionId: transaction.id,
              quantity: creditEntry.quantity,
              vintage: creditEntry.vintage,
              ownerId: creditEntry.ownerId,
              approvedBy: userId,
            });

            // Create timeline event for credit issuance
            const creditIssuanceEvent: VerificationEvent = {
              id: uuidv4(),
              verificationId: verification.id,
              eventType: 'credits_issued',
              message: `Carbon credits issued: ${creditEntry.quantity} tons CO2e (Serial: ${creditEntry.creditId})`,
              userId,
              metadata: {
                creditId: creditEntry.creditId,
                creditEntryId: creditEntry.id,
                transactionId: transaction.id,
                quantity: creditEntry.quantity,
                vintage: creditEntry.vintage,
                ownerId: creditEntry.ownerId,
              },
              createdAt: new Date(),
            };

            await this.verificationEventRepository.save(creditIssuanceEvent);
          } catch (creditError: unknown) {
            const errorMessage = creditError instanceof Error ? creditError.message : 'Unknown error';
            const errorStack = creditError instanceof Error ? creditError.stack : 'No stack trace';
            
            logger.error('Failed to issue credits on verification approval', {
              error: creditError instanceof Error ? {
                message: creditError.message,
                stack: creditError.stack,
                name: creditError.name,
              } : creditError,
              errorMessage,
              errorStack,
              verificationId,
              projectId: verification.projectId,
              approvedBy: userId,
            });
            
            // Don't fail the verification approval if credit issuance fails
            // This allows manual credit issuance later if needed
            // But log the error clearly for debugging
            console.error('❌ CREDIT ISSUANCE FAILED:', {
              message: errorMessage,
              stack: errorStack,
              projectId: verification.projectId,
              verificationId,
            });
            
            // Add error to timeline so it's visible
            try {
              const errorEvent: VerificationEvent = {
                id: uuidv4(),
                verificationId: verification.id,
                eventType: 'error',
                message: `Credit issuance failed: ${errorMessage}`,
                userId,
                metadata: {
                  error: errorMessage,
                  projectId: verification.projectId,
                },
                createdAt: new Date(),
              };
              await this.verificationEventRepository.save(errorEvent);
            } catch (eventError) {
              logger.error('Failed to save credit issuance error event', { eventError });
            }
          }
        }
      }
    }

    // Create timeline event (Requirement 4.11)
    const timelineEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType: 'verification_approved',
      message: notes ? `Verification approved: ${notes}` : 'Verification approved',
      userId,
      metadata: {
        status: 'approved',
        progress: 100,
        completedAt: verification.completedAt?.toISOString(),
        notes,
      },
      createdAt: new Date(),
    };

    await this.verificationEventRepository.save(timelineEvent);

    // Send notification to developer (Requirement 4.11)
    try {
      const developer = await this.userRepository.findById(verification.developerId);
      if (developer) {
        await this.emailService.sendNotificationEmail(
          developer.email,
          'Verification Approved - Karbonica',
          this.generateVerificationApprovedEmail(developer.name, verificationId)
        );

        logger.info('Verification approval notification sent', {
          verificationId,
          developerId: developer.id,
          developerEmail: developer.email,
        });
      }
    } catch (error) {
      logger.error('Failed to send verification approval notification', {
        error,
        verificationId,
        developerId: verification.developerId,
      });
      // Don't fail the approval if email fails
    }

    logger.info('Verification approved successfully', {
      verificationId,
      projectId: verification.projectId,
      approvedBy: userId,
      status: updatedVerification.status,
      progress: updatedVerification.progress,
      documentCount: documents.length,
    });

    return updatedVerification;
  }

  /**
   * Unapprove a verification request (Development only)
   * Resets an approved verification back to in_review status for testing purposes
   */
  async unapprove(
    verificationId: string,
    userId: string,
    userRole: UserRole
  ): Promise<VerificationRequest> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only administrator can unapprove
    if (userRole !== UserRole.ADMINISTRATOR) {
      throw new Error('Only administrators can unapprove verifications');
    }

    // Validate verification is in approved status
    if (verification.status !== VerificationStatus.APPROVED) {
      throw new Error('Verification must be approved to be unapproved');
    }

    // Check if credits were already issued (warning only, don't block)
    if (this.creditService) {
      try {
        const existingCredits = await this.creditService.getCreditsByProject(verification.projectId);
        if (existingCredits.length > 0) {
          logger.warn('Unapproving verification with existing credits', {
            verificationId,
            projectId: verification.projectId,
            creditCount: existingCredits.length,
            unapprovedBy: userId,
          });
        }
      } catch (error) {
        // Don't fail if we can't check credits
        logger.warn('Could not check for existing credits during unapprove', { error });
      }
    }

    // Reset verification status to "in_review" and progress to 90% (keep most progress)
    verification.status = VerificationStatus.IN_REVIEW;
    verification.progress = 90;
    verification.completedAt = null;

    const updatedVerification = await this.verificationRepository.update(verification);

    // Reset project status to "pending" (Requirement: project should not be verified if verification is not approved)
    if (this.projectRepository) {
      const project = await this.projectRepository.findById(verification.projectId);
      if (project) {
        project.status = ProjectStatus.PENDING;
        await this.projectRepository.update(project);

        logger.info('Project status reset to pending after verification unapproval', {
          projectId: project.id,
          verificationId,
          unapprovedBy: userId,
        });
      }
    }

    // Create timeline event
    const unapproveEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType: 'status_changed',
      message: 'Verification unapproved and reset to in_review status (Development mode)',
      userId,
      metadata: {
        previousStatus: VerificationStatus.APPROVED,
        newStatus: VerificationStatus.IN_REVIEW,
        reason: 'Development testing',
      },
      createdAt: new Date(),
    };

    await this.verificationEventRepository.save(unapproveEvent);

    logger.info('Verification unapproved successfully', {
      verificationId,
      projectId: verification.projectId,
      unapprovedBy: userId,
      status: updatedVerification.status,
      progress: updatedVerification.progress,
    });

    return updatedVerification;
  }

  /**
   * Reject a verification request
   * Requirements: 4.8, 4.11
   */
  async reject(
    verificationId: string,
    reason: string,
    userId: string,
    userRole: UserRole
  ): Promise<VerificationRequest> {
    // Get verification request
    const verification = await this.verificationRepository.findById(verificationId);
    if (!verification) {
      throw new Error('Verification request not found');
    }

    // Authorization: Only assigned verifier or administrator can reject (Requirements 8.8)
    if (userRole !== UserRole.ADMINISTRATOR && verification.verifierId !== userId) {
      throw new Error('You do not have permission to reject this verification');
    }

    // Validate verification is in correct status
    if (verification.status !== VerificationStatus.IN_REVIEW) {
      throw new Error('Verification must be in review status to be rejected');
    }

    // Validate rejection reason is provided (Requirement 4.8)
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    if (reason.length > 1000) {
      throw new Error('Rejection reason cannot exceed 1000 characters');
    }

    // Update verification status to "rejected" and progress to 100% (Requirement 4.8)
    verification.status = VerificationStatus.REJECTED;
    verification.progress = 100;
    verification.completedAt = new Date();
    verification.notes = reason;

    const updatedVerification = await this.verificationRepository.update(verification);

    // Create timeline event (Requirement 4.11)
    const timelineEvent: VerificationEvent = {
      id: uuidv4(),
      verificationId: verification.id,
      eventType: 'verification_rejected',
      message: `Verification rejected: ${reason}`,
      userId,
      metadata: {
        status: 'rejected',
        progress: 100,
        completedAt: verification.completedAt?.toISOString(),
        rejectionReason: reason,
      },
      createdAt: new Date(),
    };

    await this.verificationEventRepository.save(timelineEvent);

    // Send notification to developer (Requirement 4.11)
    try {
      const developer = await this.userRepository.findById(verification.developerId);
      if (developer) {
        await this.emailService.sendNotificationEmail(
          developer.email,
          'Verification Rejected - Karbonica',
          this.generateVerificationRejectedEmail(developer.name, verificationId, reason)
        );

        logger.info('Verification rejection notification sent', {
          verificationId,
          developerId: developer.id,
          developerEmail: developer.email,
        });
      }
    } catch (error) {
      logger.error('Failed to send verification rejection notification', {
        error,
        verificationId,
        developerId: verification.developerId,
      });
      // Don't fail the rejection if email fails
    }

    logger.info('Verification rejected successfully', {
      verificationId,
      projectId: verification.projectId,
      rejectedBy: userId,
      status: updatedVerification.status,
      progress: updatedVerification.progress,
      rejectionReason: reason,
    });

    return updatedVerification;
  }

  private generateVerifierAssignmentEmail(
    verifierName: string,
    projectName: string,
    verificationId: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #2c5f2d; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .info-box {
            background-color: #e8f5e9;
            border-left: 4px solid #2c5f2d;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🌱 Karbonica</h1>
            <p style="margin: 5px 0 0 0;">Carbon Credit Registry Platform</p>
          </div>
          <div class="content">
            <h2>Hi ${verifierName},</h2>
            <p>You have been assigned to verify a new carbon offset project.</p>
            
            <div class="info-box">
              <strong>Verification ID:</strong> ${verificationId}<br>
              <strong>Project:</strong> ${projectName}<br>
              <strong>Status:</strong> In Review<br>
              <strong>Progress:</strong> 30%
            </div>

            <p>Please review the project details and documentation, then proceed with the verification process.</p>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review project documentation</li>
              <li>Upload verification documents</li>
              <li>Add timeline events as needed</li>
              <li>Approve or reject the verification</li>
            </ul>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verifications/${verificationId}" class="button">View Verification</a>
            </div>

            <p>If you have any questions, please contact the administrator.</p>
          </div>
          <div class="footer">
            <p>© 2024 Karbonica. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateVerificationApprovedEmail(developerName: string, verificationId: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #2c5f2d; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .success-box {
            background-color: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin: 20px 0;
          }
          .celebration {
            font-size: 24px;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🌱 Karbonica</h1>
            <p style="margin: 5px 0 0 0;">Carbon Credit Registry Platform</p>
          </div>
          <div class="content">
            <div class="celebration">🎉 Congratulations! 🎉</div>
            
            <h2>Hi ${developerName},</h2>
            <p>Great news! Your project verification has been <strong>approved</strong>.</p>
            
            <div class="success-box">
              <strong>✅ Verification Status:</strong> Approved<br>
              <strong>📋 Verification ID:</strong> ${verificationId}<br>
              <strong>📈 Progress:</strong> 100% Complete<br>
              <strong>🏆 Project Status:</strong> Verified
            </div>

            <p><strong>What happens next:</strong></p>
            <ul>
              <li>🪙 Carbon credits will be automatically issued for your project</li>
              <li>📊 Your project is now visible to buyers on the marketplace</li>
              <li>💰 You can transfer or retire your carbon credits</li>
              <li>📈 Track your project's impact and credit transactions</li>
            </ul>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${verificationId}" class="button">View Your Project</a>
            </div>

            <p>Thank you for contributing to carbon offset initiatives and helping fight climate change!</p>
          </div>
          <div class="footer">
            <p>© 2024 Karbonica. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateVerificationRejectedEmail(
    developerName: string,
    verificationId: string,
    rejectionReason: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #2c5f2d; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .rejection-box {
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            padding: 15px;
            margin: 20px 0;
          }
          .reason-box {
            background-color: #fff3e0;
            border: 1px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🌱 Karbonica</h1>
            <p style="margin: 5px 0 0 0;">Carbon Credit Registry Platform</p>
          </div>
          <div class="content">
            <h2>Hi ${developerName},</h2>
            <p>We regret to inform you that your project verification has been <strong>rejected</strong>.</p>
            
            <div class="rejection-box">
              <strong>❌ Verification Status:</strong> Rejected<br>
              <strong>📋 Verification ID:</strong> ${verificationId}<br>
              <strong>📈 Progress:</strong> 100% Complete<br>
              <strong>📅 Completed:</strong> ${new Date().toLocaleDateString()}
            </div>

            <div class="reason-box">
              <strong>📝 Rejection Reason:</strong><br>
              ${rejectionReason}
            </div>

            <p><strong>What you can do next:</strong></p>
            <ul>
              <li>📋 Review the rejection reason carefully</li>
              <li>📄 Update your project documentation to address the issues</li>
              <li>🔄 Resubmit your project for verification once improvements are made</li>
              <li>💬 Contact support if you need clarification on the rejection</li>
            </ul>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${verificationId}" class="button">View Your Project</a>
            </div>

            <p>Don't be discouraged! Many successful projects require multiple iterations. We're here to help you succeed in your carbon offset initiatives.</p>
          </div>
          <div class="footer">
            <p>© 2024 Karbonica. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
