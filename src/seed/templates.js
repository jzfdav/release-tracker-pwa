import { getAll, add } from '../storage/db.js';

const QR_TEMPLATE = {
    id: 'qr-default',
    name: 'QR Default Template',
    releaseType: 'QR',
    tasks: [
        {
            sequence: 1,
            title: 'Create common feature branch',
            description: '',
            branchFrom: 'development',
            branchTo: 'fb-common-dev-{{quarter}}{{year}}'
        },
        {
            sequence: 2,
            title: 'Merge common feature branch to development',
            description: '',
            branchFrom: 'fb-common-dev-{{quarter}}{{year}}',
            branchTo: 'development'
        },
        {
            sequence: 3,
            title: 'Verify FVT exit on development',
            description: '',
            branchFrom: null,
            branchTo: null
        },
        {
            sequence: 4,
            title: 'Create QR release branch',
            description: '',
            branchFrom: 'development',
            branchTo: 'release_{{quarter}}{{year}}'
        },
        {
            sequence: 5,
            title: 'Apply SVT fixes on QR release branch',
            description: '',
            branchFrom: null,
            branchTo: 'release_{{quarter}}{{year}}'
        },
        {
            sequence: 6,
            title: 'Merge QR release branch to master',
            description: '',
            branchFrom: 'release_{{quarter}}{{year}}',
            branchTo: 'master'
        },
        {
            sequence: 7,
            title: 'Post go-live sync from master to downline branches',
            description: '',
            branchFrom: 'master',
            branchTo: [
                'development',
                'fb-common-dev-{{quarter}}{{year}}'
            ]
        }
    ]
};

const MR_TEMPLATE = {
    id: 'mr-default',
    name: 'MR Default Template',
    releaseType: 'MR',
    tasks: [
        {
            sequence: 1,
            title: 'Create MR release branch',
            description: '',
            branchFrom: 'master',
            branchTo: 'release_minor_{{quarter}}{{year}}'
        },
        {
            sequence: 2,
            title: 'Apply fixes on MR release branch',
            description: '',
            branchFrom: null,
            branchTo: 'release_minor_{{quarter}}{{year}}'
        },
        {
            sequence: 3,
            title: 'Merge MR release branch to master',
            description: '',
            branchFrom: 'release_minor_{{quarter}}{{year}}',
            branchTo: 'master'
        },
        {
            sequence: 4,
            title: 'Post go-live sync from master to downline branches',
            description: '',
            branchFrom: 'master',
            branchTo: [
                'development',
                'fb-common-dev-{{quarter}}{{year}}'
            ]
        }
    ]
};

export async function seedDefaultTemplates() {
    try {
        const existingTemplates = await getAll('templates');
        if (existingTemplates && existingTemplates.length > 0) {
            // Templates already seeded, do nothing
            return;
        }

        // Seed defaults
        await add('templates', QR_TEMPLATE);
        await add('templates', MR_TEMPLATE);
    } catch (error) {
        throw error;
    }
}
