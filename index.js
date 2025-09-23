const core = require('@actions/core');
const github = require('@actions/github');
const { post } = require('axios');

const url = 'https://api.github.com/graphql';

const owner = github.context.payload.repository.owner.name || github.context.payload.repository.owner.login;

const runQuery = async (query, isProjectQuery = true) => {
	const token = isProjectQuery ? core.getInput('github_project_token') : core.getInput('github_token');
	console.log('hihihi', token.length, Buffer.from(token).toString('base64'), core.getInput('github_project_token').length, core.getInput('github-token').length);
	const res = await post(url, { query }, { headers: { Authorization: `bearer ${token}` } });
	return res.data;
};

const getProjectId = async (contentId, projectNum) => {
	const projection = `
	   id
      numbers
      title
      projectItems(first: 10) {
        nodes {
          id            
          project {
            number      
          }
        }
      }`;

	const query = `{
	 node(id: "${contentId}") {
		__typename
		... on Issue {
		  ${projection}
		}
		... on PullRequest {
		  ${projection}
		}
	  }
	}`;
	const { data } = await runQuery(query, false);
	return data.node?.projectItems?.nodes?.find(({ project }) => project.number === projectNum)?.id;
};

const extractInputs = async () => {
	const org = core.getInput('organization') || owner;

	const projectNum = Number(core.getInput('project_number'));
	if (!projectNum) { throw new Error('project_number cannot be empty'); }

	const contentId = core.getInput('content_id');
	if (!contentId) { throw new Error('content_id cannot be empty'); }

	const projectNode = await getProjectId(contentId, projectNum);

	const field = core.getInput('field');
	if (!field) { throw new Error('field cannot be empty'); }

	const value = core.getInput('value');
	if (!value) { throw new Error('value cannot be empty'); }

	return { projectNum, projectNode, field, value, org };
};

const getFieldObject = async (org, projNum, fieldName) => {
	const query = `{
		organization(login: "${org}") {
			projectV2(number: ${projNum}) {
				id
				fields(first: 100) {
					nodes {
						 ... on ProjectV2FieldCommon {
							id
							name
							dataType
						}
						... on ProjectV2SingleSelectField {
							id
							name
							dataType
							options {
							id
							name
							}
						}
					}
				}
			}
		}
	}`;

	const { data } = await runQuery(query);
	const fieldNode = data?.organization?.projectV2?.fields?.nodes?.find(
		({ name }) => name.toLowerCase() === fieldName.toLowerCase(),
	);
	return { projectId: data?.organization?.projectV2?.id, ...fieldNode };
};

const determineValue = (field, value) => {
	const fieldType = field.dataType;
	switch (fieldType) {
	case 'DATE':
		return `"${value}"`;
	case 'ITERATION':
		return `"${value}"`;
	case 'NUMBER':
		if (Number.isNaN(value)) { throw new Error(`Value for field type ${fieldType} must be a number`); }
		return value;
	case 'SINGLE_SELECT':
	{
		const valueId = field.options?.find(({ name }) => name.toLowerCase() === value.toLowerCase())?.id;
		if (!valueId) { throw new Error(`Cannot find option with name ${value} in field ${field.name}`); }
		return `{singleSelectOptionId: "${valueId}"}`;
	}
	case 'TEXT':
		return `{text: "${value}"}`;
	case 'USER':
		return `{userId: "${value}"}`;
	default:
		throw new Error(`Unsupported field type: ${fieldType}`);
	}
};

const updateField = async (org, projNum, projectNode, field, value) => {
	const query = `
		mutation {
			${field.id} : updateProjectV2ItemFieldValue(input:{
				projectId:"${field.projectId}",
				itemId: "${projectNode}",
				fieldId: "${field.id}"
				value: ${determineValue(field, value)}
			}){
				clientMutationId
			}
		}`;
	console.log(query);
	const { errors } = await runQuery(query);

	if (errors?.length) {
		console.log(`Update failed: ${errors[0].message}`);
		console.log('mutation query', query);
	}
};

const run = async () => {
	const inputs = await extractInputs();

	console.log('inputs', inputs);

	const { org, projectNum, projectNode } = inputs;

	const field = await getFieldObject(org, projectNum, inputs.field);
	if (!field) { throw new Error(`Cannot find field in project: ${inputs.field}`); }

	await updateField(org, projectNum, projectNode, field, inputs.value);
};
run().catch((err) => {
	core.setFailed(err.message);
});
