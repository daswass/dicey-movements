import React from "react";
import { Link } from "react-router-dom";

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
          <div className="mb-6">
            <Link
              to="/"
              className="text-blue-500 hover:text-blue-400 transition-colors mb-4 inline-block">
              ← Back to App
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                By accessing and using Wassercise ("the Service"), you accept and agree to be bound
                by the terms and provision of this agreement. If you do not agree to abide by the
                above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                2. Description of Service
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Wassercise is a fitness application that provides:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Randomized workout generation through dice rolling mechanics</li>
                <li>Timer functionality for workout sessions</li>
                <li>Progress tracking and achievement systems</li>
                <li>Social features including friend connections and leaderboards</li>
                <li>Integration with Oura wearable devices for enhanced fitness tracking</li>
                <li>Personalized fitness recommendations and statistics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                3. User Accounts and Registration
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                To access certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information to keep it accurate</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                4. Oura Integration
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our Service integrates with Oura wearable devices. By connecting your Oura account:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>
                  You authorize us to access and process your Oura data in accordance with our
                  Privacy Policy
                </li>
                <li>
                  You acknowledge that Oura's own terms of service and privacy policy also apply to
                  your Oura data
                </li>
                <li>You can revoke this access at any time through your Oura account settings</li>
                <li>We will only access data that you explicitly authorize through the Oura API</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                We are not responsible for the accuracy, completeness, or availability of Oura data,
                and we do not guarantee that the integration will be available at all times.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                5. Acceptable Use
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You agree to use the Service only for lawful purposes and in accordance with these
                Terms. You agree not to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Share inappropriate, offensive, or harmful content</li>
                <li>Use automated systems to access the Service without permission</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                6. Health and Safety Disclaimer
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong>IMPORTANT:</strong> The Service provides fitness recommendations and
                tracking tools, but we are not medical professionals. You acknowledge that:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Exercise involves inherent risks, and you participate at your own risk</li>
                <li>
                  You should consult with a healthcare provider before starting any fitness program
                </li>
                <li>
                  You are responsible for determining if exercises are appropriate for your fitness
                  level and health condition
                </li>
                <li>
                  We are not liable for any injuries or health issues that may result from using our
                  Service
                </li>
                <li>
                  You should stop exercising immediately if you experience pain, dizziness, or other
                  concerning symptoms
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                7. Intellectual Property
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The Service and its original content, features, and functionality are owned by
                Wassercise and are protected by international copyright, trademark, patent, trade
                secret, and other intellectual property laws.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                You retain ownership of any content you submit to the Service, but you grant us a
                license to use, modify, and display such content in connection with providing the
                Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                8. Privacy and Data Protection
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Your privacy is important to us. Our collection and use of personal information is
                governed by our Privacy Policy, which is incorporated into these Terms by reference.
                By using the Service, you consent to our collection and use of information as
                described in our Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                9. Service Availability and Modifications
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We strive to provide reliable service but cannot guarantee that the Service will be
                available at all times. We may:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Modify, suspend, or discontinue the Service at any time</li>
                <li>Update features and functionality</li>
                <li>Perform maintenance that may temporarily affect availability</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                We will provide reasonable notice of any material changes to the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                10. Limitation of Liability
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                To the maximum extent permitted by law, Wassercise shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, including but not
                limited to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Loss of profits, data, or use</li>
                <li>Business interruption</li>
                <li>Personal injury or property damage</li>
                <li>Any damages resulting from the use of third-party services (including Oura)</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                Our total liability to you for any claims arising from these Terms or the Service
                shall not exceed the amount you paid us in the 12 months preceding the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                11. Indemnification
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You agree to defend, indemnify, and hold harmless Wassercise and its officers,
                directors, employees, and agents from and against any claims, damages, obligations,
                losses, liabilities, costs, or debt arising from:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Any activity related to your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                12. Termination
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may terminate or suspend your account and access to the Service immediately,
                without prior notice, for any reason, including breach of these Terms. Upon
                termination:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Your right to use the Service will cease immediately</li>
                <li>We may delete your account and associated data</li>
                <li>
                  Provisions of these Terms that should survive termination will remain in effect
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                13. Governing Law and Dispute Resolution
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of [Your
                Jurisdiction], without regard to its conflict of law provisions. Any disputes
                arising from these Terms or the Service shall be resolved through binding
                arbitration in accordance with the rules of [Arbitration Organization].
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                14. Changes to Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We reserve the right to modify these Terms at any time. We will notify users of any
                material changes by posting the new Terms on this page and updating the "Last
                updated" date. Your continued use of the Service after such changes constitutes
                acceptance of the updated Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                15. Contact Information
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Email:</strong> DiceyTerms@sserman.com
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Address:</strong> 157 School Ln, Lido Beach, NY 11561
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
