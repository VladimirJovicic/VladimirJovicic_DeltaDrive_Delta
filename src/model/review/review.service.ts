import { Injectable } from '@nestjs/common';
import { Review } from './review';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GuidService } from '../../services';
import { ReviewDto } from './dto';
import { Vehicle } from '../vehicle';

@Injectable()
export class ReviewService {
    public constructor(
        @InjectModel(Review.name) private reviewModel: Model<Review>,
        private readonly guidService: GuidService
    ) {}

    /**
     * Fetches the review by the uuid
     * @param uuid The uuid of the review
     * @returns The review
     */
    public async get(uuid: string): Promise<Review> {
        return await this.reviewModel.findOne({ uuid });
    }


    /**
     * Inserts an empty pending review request that the user can fill out at any time.
     * The review will only appear for the driver if when the user completes the review
     * @param email The email of the user
     * @param vehicleId The vehicle id
     */
    public async insertReviewRequest(email: string, vehicleId: string, price: number): Promise<void> {
        const uuid = this.guidService.generateGuid();
        await this.reviewModel.create({
            uuid,
            email,
            vehicleId,
            dateOfRide: new Date(),
            price,
            completed: false,
        });
    }

    /**
     * Fetches all pending and completed reviews for a user
     * @param email The email of the user
     * @returns An array of the reviews distributes by completed and pending
     */
    public async getAllReviews(email: string): Promise<{ completed: ReviewDto[]; pending: ReviewDto[]; }> {
        // Fetch the reviews by joining with the vehicle by the id
        const reviews: Review[] = await this.reviewModel.aggregate([
            { $match: { email } }, // Match the review the email
            {
              $lookup: {
                from: 'vehicles', // Name of the vehicles collection
                localField: 'vehicleId', // Field in the review model
                foreignField: 'uuid', // Field in the vehicles collection
                as: 'vehicle' // Name of the field to store the matched vehicles
              }
            }
          ]);

        const pending: ReviewDto[] = []
        const completed: ReviewDto[] = []
        for (let review of reviews) {
            // The vehicle was queried by uuid so it should be only 1 vehicle returned
            const vehicleData: Vehicle = review.vehicle[0];
            const reviewDto: ReviewDto = {
                dateOfRide: review.dateOfRide,
                uuid: review.uuid,
                price: review.price,
                vehicle: {
                    vehicleId: vehicleData?.uuid || 'Id not found',
                    brand: vehicleData?.brand || 'Brand not found',
                    firstName: vehicleData?.firstName || 'First name not found',
                    lastName: vehicleData?.lastName || 'Last name not found'
                }
            }

            // Add the rate if it is present
            if (review.rate != null) {
                reviewDto.rate = review.rate
            }

            // Add the comment if it is present
            if (review.comment != null) {
                reviewDto.comment = review.comment
            }

            // Distribute the reviews by completed and pending
            if (review.completed) {
                completed.push(reviewDto)
            } else {
                pending.push(reviewDto);
            }
        }
        return { completed, pending }
    }

    public async leaveReview(review: Review): Promise<void> {
        await this.reviewModel.updateOne(
            { uuid: review.uuid },
            review
        );
    }
   
}
