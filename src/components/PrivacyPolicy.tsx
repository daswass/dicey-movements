import React from "react";
import { Link } from "react-router-dom";

const PrivacyPolicy: React.FC = () => {
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
              Privacy Policy
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                1. Introduction
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Wassercise ("we," "our," or "us") is committed to protecting your privacy. This
                Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use our fitness application and related services.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                By using our application, you consent to the data practices described in this
                policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-medium mb-3 text-gray-900 dark:text-white">
                2.1 Personal Information
              </h3>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Email address and authentication information</li>
                <li>Username and profile information</li>
                <li>Location data (with your consent)</li>
                <li>Fitness and workout data</li>
                <li>Device information and usage statistics</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 text-gray-900 dark:text-white">
                2.2 Oura Integration Data
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you connect your Oura account, we may access and store:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Sleep data and metrics</li>
                <li>Activity and step counts</li>
                <li>Heart rate data</li>
                <li>Recovery metrics</li>
                <li>Other health-related data provided by Oura</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                We only access Oura data that you explicitly authorize through the Oura API
                integration. You can revoke this access at any time through your Oura account
                settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Providing and maintaining our fitness application</li>
                <li>Personalizing your workout experience</li>
                <li>Tracking your fitness progress and achievements</li>
                <li>Enabling social features and friend connections</li>
                <li>Improving our services and user experience</li>
                <li>Sending notifications and updates (with your consent)</li>
                <li>Ensuring security and preventing fraud</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                4. Data Sharing and Disclosure
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third
                parties except in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Oura Integration:</strong> We share data with Oura only as necessary to
                  provide the integration features you've requested
                </li>
                <li>
                  <strong>Service Providers:</strong> We may share data with trusted third-party
                  service providers who assist us in operating our application
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose information if required by
                  law or to protect our rights and safety
                </li>
                <li>
                  <strong>Consent:</strong> We may share information with your explicit consent
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                5. Data Security
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We implement appropriate technical and organizational security measures to protect
                your personal information against unauthorized access, alteration, disclosure, or
                destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication</li>
                <li>Secure data storage practices</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                6. Your Rights and Choices
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Access:</strong> Request access to your personal information
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal information
                </li>
                <li>
                  <strong>Portability:</strong> Request a copy of your data in a portable format
                </li>
                <li>
                  <strong>Opt-out:</strong> Opt out of certain data processing activities
                </li>
                <li>
                  <strong>Oura Integration:</strong> Revoke Oura access through your Oura account
                  settings
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                7. Data Retention
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We retain your personal information for as long as necessary to provide our services
                and fulfill the purposes outlined in this policy. When you delete your account, we
                will delete or anonymize your personal information, except where we are required to
                retain it for legal or legitimate business purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                8. Children's Privacy
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our application is not intended for children under the age of 13. We do not
                knowingly collect personal information from children under 13. If you are a parent
                or guardian and believe your child has provided us with personal information, please
                contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                9. International Data Transfers
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Your information may be transferred to and processed in countries other than your
                own. We ensure that such transfers comply with applicable data protection laws and
                that appropriate safeguards are in place to protect your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                10. Changes to This Policy
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the new policy on this page and updating the "Last
                updated" date. Your continued use of our application after such changes constitutes
                acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                11. Contact Us
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about this Privacy Policy or our data practices, please
                contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Email:</strong> DiceyPrivacy@sserman.com
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

export default PrivacyPolicy;
