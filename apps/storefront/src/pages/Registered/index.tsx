import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useB3Lang } from '@b3/lang';
import { Box, ImageListItem } from '@mui/material';

import b2bLogo from '@/assets/b2bLogo.png';
import { B3Card } from '@/components';
import B3Spin from '@/components/spin/B3Spin';
import { LOGIN_LANDING_LOCATIONS } from '@/constants';
import { useMobile, useScrollBar } from '@/hooks';
import { CustomStyleContext } from '@/shared/customStyleButton';
import { GlobalContext } from '@/shared/global';
import { getB2BAccountFormFields, getB2BCountries } from '@/shared/service/b2b';
import { bcLogin } from '@/shared/service/bc';
import { themeFrameSelector, useAppSelector } from '@/store';
import { B3SStorage, loginJump, platform } from '@/utils';
import b2bLogger from '@/utils/b3Logger';
import { getAssetUrl } from '@/utils/getAssetUrl';
import { getCurrentCustomerInfo } from '@/utils/loginInfo';

import { loginCheckout, LoginConfig } from '../Login/config';
import { type PageProps } from '../PageProps';

import { RegisteredContext } from './context/RegisteredContext';
import {
  AccountFormFieldsItems,
  b2bAddressRequiredFields,
  companyAttachmentsFields,
  getAccountFormFields,
  RegisterFieldsItems,
} from './config';
import RegisterContent from './RegisterContent';
import RegisteredStep from './RegisteredStep';
import { RegisteredContainer, RegisteredImage } from './styled';
// 1 bc 2 b2b
const formType: Array<number> = [1, 2];

function Registered(props: PageProps) {
  const { setOpenPage } = props;

  const [activeStep, setActiveStep] = useState(0);

  const b3Lang = useB3Lang();
  const [isMobile] = useMobile();

  const navigate = useNavigate();

  const IframeDocument = useAppSelector(themeFrameSelector);

  const { isCheckout, isCloseGotoBCHome, logo, registerEnabled } = useContext(GlobalContext).state;

  const {
    state: { isLoading },
    dispatch,
  } = useContext(RegisteredContext);

  const {
    accountLoginRegistration,
    portalStyle: { backgroundColor = '#FEF9F5' },
  } = useContext(CustomStyleContext).state;

  useEffect(() => {
    if (!registerEnabled) {
      navigate('/login');
    }
  }, [navigate, registerEnabled]);

  useEffect(() => {
    const getBCAdditionalFields = async () => {
      try {
        if (dispatch) {
          dispatch({
            type: 'loading',
            payload: {
              isLoading: true,
            },
          });
          dispatch({
            type: 'finishInfo',
            payload: {
              submitSuccess: false,
            },
          });
        }

        const accountFormAllFields = formType.map((item: number) => getB2BAccountFormFields(item));

        const accountFormFields = await Promise.all(accountFormAllFields);

        const newB2bAccountFormFields: AccountFormFieldsItems[] = (
          accountFormFields[1]?.accountFormFields || []
        ).map((fields: AccountFormFieldsItems) => {
          const formFields = fields;
          if (b2bAddressRequiredFields.includes(fields?.fieldId || '') && fields.groupId === 4) {
            formFields.isRequired = true;
            formFields.visible = true;
          }

          return fields;
        });

        const bcAccountFormFields = getAccountFormFields(
          accountFormFields[0]?.accountFormFields || [],
        );
        const b2bAccountFormFields = getAccountFormFields(newB2bAccountFormFields || []);

        const { countries } = await getB2BCountries();

        const newAddressInformationFields =
          b2bAccountFormFields.address?.map(
            (addressFields: Partial<RegisterFieldsItems>): Partial<RegisterFieldsItems> => {
              const fields = addressFields;
              if (addressFields.name === 'country') {
                fields.options = countries;
                fields.replaceOptions = {
                  label: 'countryName',
                  value: 'countryName',
                };
              }
              return addressFields;
            },
          ) || [];

        const newBCAddressInformationFields =
          bcAccountFormFields.address?.map(
            (addressFields: Partial<RegisterFieldsItems>): Partial<RegisterFieldsItems> => {
              const addressFormFields = addressFields;
              if (addressFields.name === 'country') {
                addressFormFields.options = countries;
                const countryDefaultValue = countries.find(
                  (country: CustomFieldItems) => country.countryName === addressFields.default,
                );
                addressFormFields.default =
                  countryDefaultValue?.countryCode || addressFields.default;
              }
              return addressFields;
            },
          ) || [];
        // accountLoginRegistration
        const { b2b, b2c } = accountLoginRegistration;
        const accountB2cEnabledInfo = b2c && !b2b;
        if (dispatch) {
          dispatch({
            type: 'all',
            payload: {
              accountType: accountB2cEnabledInfo ? '2' : '1',
              isLoading: false,
              // account
              contactInformation: [...(b2bAccountFormFields.contactInformation || [])],
              bcContactInformation: [...(bcAccountFormFields.contactInformation || [])],
              additionalInformation: [...(b2bAccountFormFields.additionalInformation || [])],
              bcAdditionalInformation: [...(bcAccountFormFields.additionalInformation || [])],
              // detail
              companyExtraFields: [],
              companyInformation: [...(b2bAccountFormFields?.businessDetails || [])],
              companyAttachment: [...companyAttachmentsFields(b3Lang)],
              addressBasicFields: [...newAddressInformationFields],
              bcAddressBasicFields: [...newBCAddressInformationFields],
              countryList: [...countries],
              // password
              passwordInformation: [...(b2bAccountFormFields.password || [])],
              bcPasswordInformation: [...(bcAccountFormFields.password || [])],
            },
          });
        }
      } catch (e) {
        b2bLogger.error(e);
      }
    };

    getBCAdditionalFields();
    // disabling as we only need to run this once and values at starting render are good enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = async () => {
    setActiveStep((prevActiveStep: number) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep: number) => prevActiveStep - 1);
  };

  const clearRegisterInfo = () => {
    if (dispatch) {
      dispatch({
        type: 'all',
        payload: {
          accountType: '',
          isLoading: false,
          submitSuccess: false,
          contactInformation: [],
          additionalInformation: [],
          companyExtraFields: [],
          companyInformation: [],
          companyAttachment: [],
          addressBasicFields: [],
          addressExtraFields: [],
          countryList: [],
          passwordInformation: [],
        },
      });
    }
  };

  const handleFinish = async ({ email, password }: LoginConfig) => {
    dispatch({
      type: 'loading',
      payload: {
        isLoading: true,
      },
    });

    if (isCheckout) {
      try {
        await loginCheckout({ email, password });
        window.location.reload();
      } catch (error) {
        b2bLogger.error(error);
      }
    } else {
      try {
        const customer = await bcLogin({ email, password }).then(
          (res) => res?.data?.login?.customer,
        );

        if (customer) {
          B3SStorage.set('loginCustomer', {
            emailAddress: customer.email,
            phoneNumber: customer.phone,
            ...customer,
          });
        }

        await getCurrentCustomerInfo();

        clearRegisterInfo();

        const isLoginLandLocation = loginJump(navigate);

        if (platform === 'catalyst') {
          const landingLoginLocation = isLoginLandLocation
            ? LOGIN_LANDING_LOCATIONS.HOME
            : LOGIN_LANDING_LOCATIONS.BUYER_PORTAL;

          window.b2b.callbacks.dispatchEvent('on-registered', {
            email: customer.emailAddress,
            password: customer.password,
            landingLoginLocation,
          });
          window.location.hash = '';
          return;
        }

        if (!isLoginLandLocation) return;

        if (isCloseGotoBCHome) {
          window.location.href = '/';
        } else {
          navigate('/orders');
        }
      } catch (error) {
        b2bLogger.error(error);
      }
    }

    dispatch({
      type: 'loading',
      payload: {
        isLoading: false,
      },
    });
  };

  useEffect(() => {
    IframeDocument?.body.scrollIntoView(true);
    // disabling as we only need to run this when activeStep changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  useScrollBar(false);

  return (
    <B3Card setOpenPage={setOpenPage}>
      <RegisteredContainer isMobile={isMobile}>
        <B3Spin isSpinning={isLoading} tip={b3Lang('global.tips.loading')} transparency="0">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              alignItems: 'center',
            }}
          >
            <RegisteredImage>
              <ImageListItem
                sx={{
                  maxWidth: '250px',
                }}
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                <img
                  src={logo || getAssetUrl(b2bLogo)}
                  alt={b3Lang('global.tips.registerLogo')}
                  loading="lazy"
                />
              </ImageListItem>
            </RegisteredImage>
            <RegisteredStep activeStep={activeStep} backgroundColor={backgroundColor}>
              <RegisterContent
                activeStep={activeStep}
                handleBack={handleBack}
                handleNext={handleNext}
                handleFinish={handleFinish}
              />
            </RegisteredStep>
          </Box>
        </B3Spin>
      </RegisteredContainer>
    </B3Card>
  );
}

export default Registered;
